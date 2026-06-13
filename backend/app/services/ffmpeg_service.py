"""FFmpeg service for audio trimming and video compositing.

Handles two core operations:
1. Audio trimming (Phase 4) - extracting 30-second clips from uploaded audio
2. Reel rendering (Phase 11) - compositing video + text overlay + audio into
   final 1080x1920 Instagram reels

The render pipeline:
- Input video: scaled/cropped to 1080x1920 portrait
- Text overlay: drawtext filter chain from TextRenderService (Phase 10)
- Audio: trimmed audio track mixed into output
- Output: H.264 MP4, 30fps, AAC audio, faststart for web playback

Supports mock mode for development without real video clips.
"""

import asyncio
import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# Reel output specifications
REEL_WIDTH = 1080
REEL_HEIGHT = 1920
REEL_FPS = 30
REEL_DURATION = 30.0

# FFmpeg encoding presets
VIDEO_CODEC = "libx264"
VIDEO_PRESET = "medium"
VIDEO_CRF = "23"
AUDIO_CODEC = "aac"
AUDIO_BITRATE = "128k"


class FFmpegService:
    """Handles all FFmpeg operations for audio/video processing.

    All methods have both sync and async versions:
    - sync: for use in Celery workers (render_reel_sync, trim_audio_sync)
    - async: for use in FastAPI endpoints (render_reel, trim_audio)
    """

    def __init__(self) -> None:
        self._verify_ffmpeg()

    @staticmethod
    def _verify_ffmpeg() -> None:
        """Verify FFmpeg is available on the system."""
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                version_line = result.stdout.split("\n")[0]
                logger.info("FFmpeg available: %s", version_line)
            else:
                logger.warning("FFmpeg check returned non-zero exit code")
        except FileNotFoundError:
            logger.error("FFmpeg not found on system PATH!")
        except Exception as e:
            logger.warning("Could not verify FFmpeg: %s", e)

    # ── Audio Trimming ──────────────────────────────────────────────

    async def trim_audio(
        self,
        input_path: str,
        output_path: str,
        start_sec: float,
        duration: float = 30.0,
    ) -> str:
        """Extract a clip from audio using FFmpeg (async wrapper).

        Uses -ss before -i for fast seek, -t for duration.

        Args:
            input_path: Path to source audio file
            output_path: Path to write trimmed audio
            start_sec: Start time in seconds
            duration: Clip duration in seconds

        Returns:
            Path to the trimmed output file
        """
        return await asyncio.get_event_loop().run_in_executor(
            None,
            self.trim_audio_sync,
            input_path,
            output_path,
            start_sec,
            duration,
        )

    def trim_audio_sync(
        self,
        input_path: str,
        output_path: str,
        start_sec: float,
        duration: float = 30.0,
    ) -> str:
        """Extract a clip from audio using FFmpeg (sync for Celery).

        Args:
            input_path: Path to source audio file
            output_path: Path to write trimmed audio
            start_sec: Start time in seconds
            duration: Clip duration in seconds

        Returns:
            Path to the trimmed output file
        """
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start_sec:.3f}",
            "-i", input_path,
            "-t", f"{duration:.3f}",
            "-c:a", "aac",
            "-b:a", AUDIO_BITRATE,
            "-ar", "44100",
            "-ac", "2",
            output_path,
        ]

        logger.info("Trimming audio: start=%.1fs duration=%.1fs", start_sec, duration)
        self._run_ffmpeg(cmd)
        return output_path

    # ── Reel Rendering ──────────────────────────────────────────────

    async def render_reel(
        self,
        video_path: str,
        audio_path: str,
        text_filters: str,
        output_path: str,
        duration: float = REEL_DURATION,
    ) -> str:
        """Composite video + text overlay + audio into final reel (async).

        Args:
            video_path: Path to the source video clip
            audio_path: Path to the audio file
            text_filters: FFmpeg drawtext filter chain from TextRenderService
            output_path: Path to write the final MP4
            duration: Target duration in seconds

        Returns:
            Path to the rendered output file
        """
        return await asyncio.get_event_loop().run_in_executor(
            None,
            self.render_reel_sync,
            video_path,
            audio_path,
            text_filters,
            output_path,
            duration,
        )

    def render_reel_sync(
        self,
        video_path: str,
        audio_path: str,
        text_filters: str,
        output_path: str,
        duration: float = REEL_DURATION,
    ) -> str:
        """Composite video + text overlay + audio into final reel (sync for Celery).

        Pipeline:
        1. Input video → scale to 1080x1920 (crop center if aspect differs)
        2. Apply FPS conversion to 30fps
        3. Trim video to target duration
        4. Apply text overlay drawtext filters
        5. Mux with audio track
        6. Encode H.264 + AAC with faststart

        Args:
            video_path: Path to the source video clip
            audio_path: Path to the audio file
            text_filters: FFmpeg drawtext filter chain from TextRenderService
            output_path: Path to write the final MP4
            duration: Target duration in seconds

        Returns:
            Path to the rendered output file
        """
        logger.info(
            "Rendering reel: video=%s audio=%s duration=%.1fs output=%s",
            video_path, audio_path, duration, output_path,
        )

        # Build the video filter chain
        video_chain = self._build_video_filter_chain(text_filters, duration)
        logger.info("Video filter chain length: %d chars", len(video_chain))

        # Build the FFmpeg command
        cmd = [
            "ffmpeg", "-y",
            # Input 0: video
            "-i", video_path,
            # Input 1: audio
            "-i", audio_path,
            # Video filter complex
            "-filter_complex", video_chain,
            # Map filtered video and audio
            "-map", "[vout]",
            "-map", "1:a",
            # Video encoding
            "-c:v", VIDEO_CODEC,
            "-preset", VIDEO_PRESET,
            "-crf", VIDEO_CRF,
            "-pix_fmt", "yuv420p",
            # Audio encoding
            "-c:a", AUDIO_CODEC,
            "-b:a", AUDIO_BITRATE,
            "-ar", "44100",
            # Duration limit
            "-t", f"{duration:.3f}",
            # Fast start for web playback
            "-movflags", "+faststart",
            # Shorter key-frame interval for seeking
            "-g", str(REEL_FPS * 2),
            output_path,
        ]

        self._run_ffmpeg(cmd, timeout=300)

        # Verify output exists
        if not os.path.exists(output_path):
            raise RuntimeError(f"FFmpeg render failed: output file not created at {output_path}")

        file_size = os.path.getsize(output_path)
        logger.info(
            "Reel rendered successfully: %s (%.2f MB)",
            output_path,
            file_size / (1024 * 1024),
        )
        return output_path

    def _build_video_filter_chain(self, text_filters: str, duration: float) -> str:
        """Build the complete -filter_complex string for reel rendering.

        Steps:
        1. Scale video to fill 1080x1920 (maintaining aspect ratio, center crop)
        2. Set framerate to 30fps
        3. Trim to target duration
        4. Reset timestamps
        5. Apply text overlay drawtext filters

        Args:
            text_filters: Comma-separated drawtext filter string from TextRenderService
            duration: Target duration in seconds

        Returns:
            Complete filter_complex string
        """
        # Base video processing chain
        parts = [
            # Scale to fill 1080x1920, preserving aspect ratio (may overshoot)
            f"[0:v]scale={REEL_WIDTH}:{REEL_HEIGHT}:force_original_aspect_ratio=increase",
            # Center crop to exactly 1080x1920
            f"crop={REEL_WIDTH}:{REEL_HEIGHT}",
            # Set framerate
            f"fps={REEL_FPS}",
            # Trim to duration
            f"trim=duration={duration:.3f}",
            # Reset timestamps after trim
            "setpts=PTS-STARTPTS",
        ]

        # Build base chain string
        chain = ",".join(parts)

        # Append text overlay filters if present
        if text_filters and text_filters.strip():
            chain = f"{chain},{text_filters}"

        # Label output
        chain = f"{chain}[vout]"

        return chain

    # ── Mock Media Generation ───────────────────────────────────────

    @staticmethod
    def generate_background_video(
        output_path: str,
        duration: float = REEL_DURATION,
        color: str = "0x1a1a2e",
    ) -> str:
        """Generate a solid color background video for mock/development mode.

        Creates a 1080x1920 video with a dark background using lavfi color source.

        Args:
            output_path: Path to write the video file
            duration: Video duration in seconds
            color: Hex color (0xRRGGBB format)

        Returns:
            Path to the generated video
        """
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=c={color}:s={REEL_WIDTH}x{REEL_HEIGHT}:d={duration:.1f}:r={REEL_FPS}",
            "-c:v", VIDEO_CODEC,
            "-preset", "ultrafast",
            "-crf", "28",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration:.3f}",
            output_path,
        ]

        logger.info("Generating mock background video: %s (%.1fs)", output_path, duration)
        FFmpegService._run_ffmpeg_static(cmd, timeout=60)

        if not os.path.exists(output_path):
            raise RuntimeError(f"Failed to generate background video at {output_path}")

        return output_path

    @staticmethod
    def generate_gradient_video(
        output_path: str,
        duration: float = REEL_DURATION,
    ) -> str:
        """Generate an animated gradient background video for mock mode.

        Creates a subtle dark gradient animation that looks more visually
        appealing than a solid color for testing.

        Args:
            output_path: Path to write the video file
            duration: Video duration in seconds

        Returns:
            Path to the generated video
        """
        # Use mandelbrot as a more interesting test pattern, then darkened
        # and blurred for an aesthetic background
        filter_chain = (
            f"mandelbrot=s={REEL_WIDTH}x{REEL_HEIGHT}:rate={REEL_FPS}"
            f",hue=s=0.3:b=-0.4"
            f",boxblur=lr=20:lp=5"
            f",trim=duration={duration:.1f}"
            f",setpts=PTS-STARTPTS"
        )

        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", filter_chain,
            "-c:v", VIDEO_CODEC,
            "-preset", "ultrafast",
            "-crf", "28",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration:.3f}",
            output_path,
        ]

        logger.info("Generating gradient background video: %s", output_path)
        FFmpegService._run_ffmpeg_static(cmd, timeout=120)

        if not os.path.exists(output_path):
            # Fallback to solid color if gradient generation fails
            logger.warning("Gradient failed, falling back to solid color")
            return FFmpegService.generate_background_video(output_path, duration)

        return output_path

    @staticmethod
    def generate_silence(
        output_path: str,
        duration: float = REEL_DURATION,
    ) -> str:
        """Generate a silent audio file for mock/development mode.

        Args:
            output_path: Path to write the audio file
            duration: Audio duration in seconds

        Returns:
            Path to the generated audio
        """
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"anullsrc=r=44100:cl=stereo",
            "-t", f"{duration:.3f}",
            "-c:a", AUDIO_CODEC,
            "-b:a", AUDIO_BITRATE,
            output_path,
        ]

        logger.info("Generating silence: %s (%.1fs)", output_path, duration)
        FFmpegService._run_ffmpeg_static(cmd, timeout=30)

        if not os.path.exists(output_path):
            raise RuntimeError(f"Failed to generate silence at {output_path}")

        return output_path

    # ── Video Probing ───────────────────────────────────────────────

    @staticmethod
    def probe_duration(file_path: str) -> float:
        """Get the duration of a media file using ffprobe.

        Args:
            file_path: Path to the media file

        Returns:
            Duration in seconds
        """
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception as e:
            logger.warning("ffprobe failed for %s: %s", file_path, e)

        return 0.0

    # ── Internal Helpers ────────────────────────────────────────────

    @staticmethod
    def _run_ffmpeg(cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
        """Run an FFmpeg command and handle errors.

        Args:
            cmd: Command list to execute
            timeout: Timeout in seconds

        Returns:
            Completed process result

        Raises:
            RuntimeError: If FFmpeg returns non-zero exit code
        """
        logger.debug("FFmpeg command: %s", " ".join(cmd[:10]) + "...")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            stderr = result.stderr[-2000:] if result.stderr else "(no stderr)"
            logger.error("FFmpeg failed (exit %d): %s", result.returncode, stderr)
            raise RuntimeError(
                f"FFmpeg failed with exit code {result.returncode}: {stderr}"
            )

        return result

    @staticmethod
    def _run_ffmpeg_static(cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
        """Static version of _run_ffmpeg for use in static methods."""
        logger.debug("FFmpeg command: %s", " ".join(cmd[:10]) + "...")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            stderr = result.stderr[-2000:] if result.stderr else "(no stderr)"
            logger.error("FFmpeg failed (exit %d): %s", result.returncode, stderr)
            raise RuntimeError(
                f"FFmpeg failed with exit code {result.returncode}: {stderr}"
            )

        return result


# ── Singleton ────────────────────────────────────────────────────

_ffmpeg_service: FFmpegService | None = None


def get_ffmpeg_service() -> FFmpegService:
    """Get or create the singleton FFmpegService."""
    global _ffmpeg_service
    if _ffmpeg_service is None:
        _ffmpeg_service = FFmpegService()
    return _ffmpeg_service
