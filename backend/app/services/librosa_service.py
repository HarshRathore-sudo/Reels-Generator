"""Librosa beat detection service.

Uses librosa to detect beats, estimate tempo (BPM), and compute
beat-aligned timestamps from audio files. Supports mock mode for
development when no real audio files are available.
"""

import logging
import random
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class BeatDetectionResult:
    """Result from beat detection analysis."""
    beat_timestamps: list[float]
    tempo_bpm: float
    total_beats: int

    def to_dict(self) -> dict:
        return {
            "beat_timestamps": self.beat_timestamps,
            "tempo_bpm": self.tempo_bpm,
            "total_beats": self.total_beats,
        }


class LibrosaService:
    """Handles beat detection and audio analysis using librosa.

    In mock mode (when audio_path points to an empty/nonexistent file),
    generates realistic beat data based on the audio duration.
    """

    def __init__(self) -> None:
        self._librosa = None  # Lazy import to avoid startup cost

    def _get_librosa(self):
        """Lazily import librosa (heavy import ~2s)."""
        if self._librosa is None:
            try:
                import librosa
                self._librosa = librosa
                logger.info("librosa loaded successfully (version: %s)", librosa.__version__)
            except ImportError as e:
                logger.error("librosa not installed: %s", e)
                raise RuntimeError(
                    "librosa is required for beat detection. "
                    "Install with: pip install librosa"
                ) from e
        return self._librosa

    def detect_beats(
        self,
        audio_path: str,
        audio_duration: float = 30.0,
    ) -> BeatDetectionResult:
        """Detect beats and tempo from an audio file.

        Uses librosa.beat.beat_track() for beat detection and tempo estimation.
        Falls back to mock mode if the audio file is empty or unreadable.

        Args:
            audio_path: Path to the audio file on disk.
            audio_duration: Duration of the audio in seconds (used for mock mode).

        Returns:
            BeatDetectionResult with beat_timestamps, tempo_bpm, and total_beats.
        """
        # Try real beat detection first
        try:
            return self._detect_beats_real(audio_path)
        except Exception as e:
            logger.warning(
                "Real beat detection failed (falling back to mock): %s", e
            )
            return self._detect_beats_mock(audio_duration)

    def _detect_beats_real(self, audio_path: str) -> BeatDetectionResult:
        """Run actual librosa beat detection on an audio file.

        Args:
            audio_path: Path to the audio file.

        Returns:
            BeatDetectionResult with detected beats and tempo.

        Raises:
            Exception if audio cannot be loaded or analyzed.
        """
        librosa = self._get_librosa()
        import numpy as np

        logger.info("Loading audio for beat detection: %s", audio_path)

        # Load audio (mono, 22050 Hz is librosa default)
        y, sr = librosa.load(audio_path, sr=22050, mono=True)

        if len(y) == 0:
            raise ValueError("Audio file is empty (0 samples)")

        duration = len(y) / sr
        logger.info(
            "Audio loaded: %.2fs, %d samples, sr=%d",
            duration, len(y), sr,
        )

        # Detect tempo and beat frames
        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr,
            units="frames",
        )

        # Convert beat frames to timestamps in seconds
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        # Handle tempo - librosa 0.10+ returns an array
        if isinstance(tempo, np.ndarray):
            tempo_bpm = float(tempo[0]) if len(tempo) > 0 else 120.0
        else:
            tempo_bpm = float(tempo)

        # Round timestamps to 3 decimal places
        beat_timestamps = [round(float(t), 3) for t in beat_times]

        logger.info(
            "Beat detection complete: tempo=%.1f BPM, %d beats detected",
            tempo_bpm, len(beat_timestamps),
        )

        return BeatDetectionResult(
            beat_timestamps=beat_timestamps,
            tempo_bpm=round(tempo_bpm, 1),
            total_beats=len(beat_timestamps),
        )

    def _detect_beats_mock(self, audio_duration: float) -> BeatDetectionResult:
        """Generate realistic mock beat data based on audio duration.

        Creates beats at regular intervals with slight natural variation,
        simulating what librosa would detect from a typical Bollywood track.

        Args:
            audio_duration: Duration of the audio in seconds.

        Returns:
            BeatDetectionResult with mock beat data.
        """
        # Typical Bollywood song tempo range: 90-140 BPM
        tempo_bpm = round(random.uniform(95.0, 135.0), 1)

        # Calculate beat interval from BPM
        beat_interval = 60.0 / tempo_bpm

        # Generate beat timestamps with slight natural variation
        beat_timestamps: list[float] = []
        current_time = beat_interval * 0.5  # Start half a beat in

        while current_time < audio_duration - 0.1:
            # Add slight variation (+/- 5% of beat interval) for realism
            variation = random.uniform(-0.05, 0.05) * beat_interval
            timestamp = round(current_time + variation, 3)

            if timestamp > 0 and timestamp < audio_duration:
                beat_timestamps.append(timestamp)

            current_time += beat_interval

        logger.info(
            "Mock beat detection: tempo=%.1f BPM, %d beats for %.1fs audio",
            tempo_bpm, len(beat_timestamps), audio_duration,
        )

        return BeatDetectionResult(
            beat_timestamps=beat_timestamps,
            tempo_bpm=tempo_bpm,
            total_beats=len(beat_timestamps),
        )


# --- Singleton / Dependency Injection ---

_librosa_service: LibrosaService | None = None


def get_librosa_service() -> LibrosaService:
    """Get or create the LibrosaService singleton."""
    global _librosa_service
    if _librosa_service is None:
        _librosa_service = LibrosaService()
    return _librosa_service
