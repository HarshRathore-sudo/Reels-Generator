"""Celery task for rendering a single reel.

Orchestrates the full render pipeline for one GeneratedReel record:
1. Load reel + project + lyrics + audio + clip data from DB
2. Download/generate the background video clip
3. Download/locate the trimmed audio file
4. Generate text overlay filters using TextRenderService
5. Composite everything via FFmpeg into a 1080x1920 MP4
6. Upload the result to R2 storage
7. Update the reel record with output URL and status

Progress stages reported via Celery state updates:
- loading     (0-10%)   Loading project data
- downloading (10-30%)  Downloading video clip and audio
- rendering   (30-80%)  Running FFmpeg render
- uploading   (80-95%)  Uploading to R2
- complete    (100%)    Done

Handles mock mode gracefully when Pexels/R2 are not configured:
- Generates a dark gradient background video instead of downloading
- Uses silence if audio is unavailable
- Saves output locally in mock R2 mode
"""

import logging
import os
import tempfile
import time
import uuid
from datetime import datetime

import httpx

from app.workers.celery_app import celery_app
from app.core.sync_database import get_sync_db
from app.models.db_models import (
    GeneratedReel,
    Project,
    AudioFile,
    Lyrics,
    ClipPool,
    RenderStatus,
)
from app.services.ffmpeg_service import FFmpegService, get_ffmpeg_service
from app.services.text_render_service import get_text_render_service
from app.services.r2_service import get_r2_service

logger = logging.getLogger(__name__)

# Temp directory for render artifacts inside Docker container
RENDER_TEMP_DIR = "/tmp/reel_renders"


def _ensure_temp_dir() -> str:
    """Ensure the temp render directory exists."""
    os.makedirs(RENDER_TEMP_DIR, exist_ok=True)
    return RENDER_TEMP_DIR


def _is_mock_url(url: str | None) -> bool:
    """Check if a URL is a mock/placeholder URL or a non-downloadable path."""
    if not url:
        return True
    # Not a real URL (just an R2 key path, not a full URL)
    if not url.startswith("http://") and not url.startswith("https://"):
        return True
    return (
        "mock-r2.example.com" in url
        or "mock.example.com" in url
        or ("pexels-" in url and "uhd-" in url)  # Mock Pexels URL pattern
    )


def _download_file(url: str, output_path: str, timeout: float = 60.0) -> str:
    """Download a file from a URL to a local path.

    Args:
        url: Source URL to download from
        output_path: Local path to save the file
        timeout: Request timeout in seconds

    Returns:
        Path to the downloaded file

    Raises:
        RuntimeError: If download fails
    """
    logger.info("Downloading: %s -> %s", url[:80], output_path)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(response.content)

            file_size = os.path.getsize(output_path)
            logger.info(
                "Downloaded %.2f MB to %s",
                file_size / (1024 * 1024),
                output_path,
            )
            return output_path

    except Exception as e:
        logger.error("Download failed for %s: %s", url[:80], e)
        raise RuntimeError(f"Failed to download {url[:80]}: {e}") from e


@celery_app.task(bind=True, name="render_reel")
def render_reel_task(self, reel_id: str) -> dict:
    """Render a single reel: download clip, generate text, composite, upload.

    Full pipeline for one GeneratedReel record:
    1. Load all required data from database
    2. Prepare video (download or generate mock)
    3. Prepare audio (download or generate silence)
    4. Generate text overlay FFmpeg filter string
    5. Run FFmpeg composite render
    6. Upload result to R2
    7. Update database record

    Args:
        reel_id: UUID string of the GeneratedReel record

    Returns:
        dict with render result summary
    """
    task_id = self.request.id
    logger.info("Starting render task %s for reel %s", task_id, reel_id)

    _ensure_temp_dir()
    temp_files: list[str] = []  # Track temp files for cleanup
    db = get_sync_db()

    try:
        # ── Stage 1: Load project data ──────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "loading",
            "progress": 5,
            "message": "Loading project data...",
        })

        reel = db.query(GeneratedReel).filter(
            GeneratedReel.id == uuid.UUID(reel_id)
        ).first()

        if not reel:
            raise ValueError(f"Reel {reel_id} not found")

        # Update status to rendering
        reel.render_status = RenderStatus.RENDERING
        reel.render_started_at = datetime.utcnow()
        db.commit()

        project = db.query(Project).filter(
            Project.id == reel.project_id
        ).first()
        if not project:
            raise ValueError(f"Project {reel.project_id} not found for reel {reel_id}")

        # Get lyrics
        lyrics = db.query(Lyrics).filter(
            Lyrics.project_id == reel.project_id
        ).first()
        if not lyrics:
            raise ValueError(f"No lyrics found for project {reel.project_id}")

        words = lyrics.words or []
        if not words:
            raise ValueError(f"Lyrics have no words for project {reel.project_id}")

        # Get audio file
        audio_file = db.query(AudioFile).filter(
            AudioFile.project_id == reel.project_id
        ).first()

        # Get clip pool item if assigned
        clip_item = None
        if reel.clip_pool_id:
            clip_item = db.query(ClipPool).filter(
                ClipPool.id == reel.clip_pool_id
            ).first()

        # Extract language string (handle enum or str)
        raw_lang = project.language or "en"
        language = raw_lang.value if hasattr(raw_lang, "value") else str(raw_lang)
        duration = audio_file.duration_seconds if audio_file else 30.0
        # Cap duration to 30s for reels
        duration = min(duration, 30.0)

        logger.info(
            "Reel %s: style=%d, language=%s, words=%d, duration=%.1fs, clip=%s",
            reel_id,
            reel.text_style,
            language,
            len(words),
            duration,
            clip_item.pexels_clip_id if clip_item else "none",
        )

        # ── Stage 2: Download/generate video ────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "downloading",
            "progress": 15,
            "message": "Preparing background video...",
        })

        video_path = os.path.join(
            RENDER_TEMP_DIR,
            f"video_{reel_id}.mp4",
        )
        temp_files.append(video_path)

        video_ready = False

        # Try downloading real clip from Pexels
        if clip_item and clip_item.clip_url and not _is_mock_url(clip_item.clip_url):
            try:
                _download_file(clip_item.clip_url, video_path)
                video_ready = True
                logger.info("Downloaded real Pexels clip for reel %s", reel_id)
            except Exception as e:
                logger.warning(
                    "Failed to download clip for reel %s, will generate mock: %s",
                    reel_id, e,
                )

        # Generate mock background if no real clip available
        if not video_ready:
            logger.info("Generating mock background video for reel %s", reel_id)
            # Use different dark colors for variety based on text style
            colors = {
                1: "0x1a1a2e",  # Dark blue
                2: "0x16213e",  # Navy
                3: "0x0f3460",  # Deep blue
                4: "0x1a1a1a",  # Near black
                5: "0x2c2c54",  # Dark purple
                6: "0x1e272e",  # Dark slate
            }
            color = colors.get(reel.text_style, "0x1a1a2e")
            FFmpegService.generate_background_video(video_path, duration, color)

        self.update_state(state="PROGRESS", meta={
            "stage": "downloading",
            "progress": 25,
            "message": "Preparing audio track...",
        })

        # ── Stage 3: Download/generate audio ────────────────────
        audio_path = os.path.join(
            RENDER_TEMP_DIR,
            f"audio_{reel_id}.aac",
        )
        temp_files.append(audio_path)

        audio_ready = False

        # Try using the trimmed audio URL
        audio_url = None
        if audio_file:
            audio_url = audio_file.trimmed_url or audio_file.original_url

        if audio_url and not _is_mock_url(audio_url):
            try:
                _download_file(audio_url, audio_path)
                audio_ready = True
                logger.info("Downloaded audio for reel %s", reel_id)
            except Exception as e:
                logger.warning(
                    "Failed to download audio for reel %s, will generate silence: %s",
                    reel_id, e,
                )

        # Generate silence if no real audio available
        if not audio_ready:
            logger.info("Generating silence for reel %s (mock mode)", reel_id)
            FFmpegService.generate_silence(audio_path, duration)

        # ── Stage 4: Generate text overlay ──────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "rendering",
            "progress": 35,
            "message": "Generating text overlay...",
        })

        text_service = get_text_render_service()
        text_filters = text_service.render(
            style_number=reel.text_style,
            words=words,
            language=language,
            duration=duration,
        )

        filter_count = text_filters.count("drawtext=") if text_filters else 0
        logger.info(
            "Generated %d drawtext filters for reel %s (style %d)",
            filter_count, reel_id, reel.text_style,
        )

        # ── Stage 5: FFmpeg render ──────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "rendering",
            "progress": 45,
            "message": "Rendering video with text overlay...",
        })

        output_path = os.path.join(
            RENDER_TEMP_DIR,
            f"reel_{reel_id}.mp4",
        )
        temp_files.append(output_path)

        ffmpeg = get_ffmpeg_service()
        ffmpeg.render_reel_sync(
            video_path=video_path,
            audio_path=audio_path,
            text_filters=text_filters,
            output_path=output_path,
            duration=duration,
        )

        self.update_state(state="PROGRESS", meta={
            "stage": "rendering",
            "progress": 75,
            "message": "Video rendered successfully!",
        })

        # Get output file size
        output_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        logger.info(
            "Reel %s rendered: %.2f MB",
            reel_id,
            output_size / (1024 * 1024),
        )

        # ── Stage 6: Upload to R2 ──────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "uploading",
            "progress": 85,
            "message": "Uploading rendered reel...",
        })

        r2_service = get_r2_service()
        r2_key = f"projects/{reel.project_id}/reels/{reel_id}.mp4"

        # Read the rendered file
        with open(output_path, "rb") as f:
            file_bytes = f.read()

        r2_service.upload_file_bytes(
            file_key=r2_key,
            data=file_bytes,
            content_type="video/mp4",
        )

        # Get the output URL (presigned or mock)
        if r2_service.is_configured:
            output_url = r2_service.generate_presigned_download_url(
                file_key=r2_key,
                filename=f"reel_{reel.text_style}_{reel_id[:8]}.mp4",
            )
        else:
            output_url = r2_service.get_file_url(r2_key)

        logger.info("Reel %s uploaded to: %s", reel_id, output_url[:80])

        # ── Stage 7: Update database ───────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "uploading",
            "progress": 95,
            "message": "Saving results...",
        })

        reel.render_status = RenderStatus.COMPLETE
        reel.render_completed_at = datetime.utcnow()
        reel.output_url = output_url

        # Mark clip pool item as used
        if clip_item:
            clip_item.used = True
            clip_item.used_at = datetime.utcnow()

        db.commit()

        logger.info(
            "Reel %s render COMPLETE (style=%d, size=%.2f MB, task=%s)",
            reel_id,
            reel.text_style,
            output_size / (1024 * 1024),
            task_id,
        )

        return {
            "status": "complete",
            "reel_id": reel_id,
            "project_id": str(reel.project_id),
            "text_style": reel.text_style,
            "output_url": output_url,
            "file_size_bytes": output_size,
            "drawtext_filters": filter_count,
            "duration": duration,
            "message": f"Reel rendered successfully (style {reel.text_style})",
        }

    except Exception as e:
        logger.exception("Render failed for reel %s: %s", reel_id, e)

        # Update reel status to failed
        try:
            reel_record = db.query(GeneratedReel).filter(
                GeneratedReel.id == uuid.UUID(reel_id)
            ).first()
            if reel_record:
                reel_record.render_status = RenderStatus.FAILED
                reel_record.error_message = str(e)[:1000]
                reel_record.render_completed_at = datetime.utcnow()
                db.commit()
        except Exception as db_err:
            logger.error("Failed to update reel status: %s", db_err)
            db.rollback()

        raise

    finally:
        # Cleanup temp files
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    logger.debug("Cleaned up temp file: %s", path)
            except OSError as e:
                logger.warning("Failed to cleanup %s: %s", path, e)

        db.close()
