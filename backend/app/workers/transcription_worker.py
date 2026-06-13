"""Celery task for audio transcription + beat detection.

Downloads audio from R2, runs transcription (mock or WhisperX),
saves word-level timing data to the Lyrics table, runs beat
detection with librosa, and updates the project status.
"""

import logging
import os
import tempfile
import time
import uuid

from app.workers.celery_app import celery_app
from app.core.sync_database import get_sync_db
from app.models.db_models import Project, AudioFile, Lyrics, ProjectStatus
from app.services.r2_service import get_r2_service
from app.services.transcription_service import transcribe_audio_file
from app.services.librosa_service import get_librosa_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="transcribe_audio")
def transcribe_audio_task(self, project_id: str, language: str) -> dict:
    """Run transcription + beat detection on the project's audio file.

    This Celery task:
    1. Downloads the audio (trimmed or original) from R2
    2. Runs transcription to get word-level timing
    3. Runs beat detection with librosa
    4. Saves results to the Lyrics + AudioFile tables
    5. Updates project status to 'transcribed'

    Progress is reported via task state updates for frontend polling.

    Args:
        project_id: UUID of the project
        language: Language code ('hi_dev', 'hi_rom', 'en')

    Returns:
        dict with transcription + beat detection summary
    """
    task_id = self.request.id
    logger.info("Starting transcription task %s for project %s (lang=%s)",
                task_id, project_id, language)

    # ── Stage 1: Load project data ──────────────────────────────
    self.update_state(state="PROGRESS", meta={
        "stage": "loading",
        "progress": 5,
        "message": "Loading project data...",
    })

    db = get_sync_db()
    try:
        project = db.query(Project).filter(
            Project.id == uuid.UUID(project_id)
        ).first()

        if not project:
            raise ValueError(f"Project {project_id} not found")

        audio = db.query(AudioFile).filter(
            AudioFile.project_id == uuid.UUID(project_id)
        ).first()

        if not audio:
            raise ValueError(f"No audio file for project {project_id}")

        # Use trimmed audio if available, otherwise original
        file_key = audio.trimmed_url or audio.original_url
        audio_duration = audio.duration_seconds

        logger.info("Using audio: %s (%.1fs)", file_key, audio_duration)

        # ── Stage 2: Download audio from R2 ─────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "downloading",
            "progress": 10,
            "message": "Downloading audio file...",
        })

        r2 = get_r2_service()
        audio_bytes = r2.download_file_bytes(file_key)

        # ── Stage 3: Prepare audio file ──────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "preparing",
            "progress": 20,
            "message": "Preparing audio for analysis...",
        })

        # Write to temp file for transcription + beat detection
        ext = os.path.splitext(file_key)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes) if audio_bytes else None
            tmp_path = tmp.name

        try:
            # ── Stage 4: Run transcription ──────────────────────
            self.update_state(state="PROGRESS", meta={
                "stage": "transcribing",
                "progress": 30,
                "message": "Transcribing audio (this may take a moment)...",
            })

            # Simulate processing time for realistic UX
            # In production with WhisperX, this takes 10-30s
            time.sleep(2)

            self.update_state(state="PROGRESS", meta={
                "stage": "transcribing",
                "progress": 50,
                "message": "Generating word-level alignment...",
            })

            result = transcribe_audio_file(
                audio_path=tmp_path,
                language=language,
                audio_duration=audio_duration,
            )

            time.sleep(1)

            # ── Stage 5: Run beat detection ──────────────────────
            self.update_state(state="PROGRESS", meta={
                "stage": "beats",
                "progress": 65,
                "message": "Detecting beats and rhythm...",
            })

            librosa_service = get_librosa_service()
            beat_result = librosa_service.detect_beats(
                audio_path=tmp_path,
                audio_duration=audio_duration,
            )

            logger.info(
                "Beat detection result: %.1f BPM, %d beats",
                beat_result.tempo_bpm, beat_result.total_beats,
            )

            self.update_state(state="PROGRESS", meta={
                "stage": "beats",
                "progress": 78,
                "message": "Analyzing tempo and rhythm patterns...",
            })

            time.sleep(0.5)

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        # ── Stage 6: Save to database ────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "saving",
            "progress": 88,
            "message": "Saving transcription and beat data...",
        })

        words_data = [w.to_dict() for w in result.words]

        # Delete existing lyrics for this project (replace)
        existing_lyrics = db.query(Lyrics).filter(
            Lyrics.project_id == uuid.UUID(project_id)
        ).first()
        if existing_lyrics:
            db.delete(existing_lyrics)
            db.flush()

        # Create new lyrics record
        lyrics = Lyrics(
            project_id=uuid.UUID(project_id),
            words=words_data,
            raw_transcription=result.raw_text,
        )
        db.add(lyrics)

        # Save beat detection results to AudioFile
        audio.beat_timestamps = beat_result.beat_timestamps
        audio.tempo_bpm = beat_result.tempo_bpm

        # Update project status
        project.status = ProjectStatus.TRANSCRIBED

        db.commit()
        db.refresh(lyrics)

        logger.info(
            "Transcription + beat detection complete for project %s: "
            "%d words, %d lines, %.1f BPM, %d beats",
            project_id, len(words_data),
            max((w["line_index"] for w in words_data), default=0) + 1,
            beat_result.tempo_bpm, beat_result.total_beats,
        )

        # ── Stage 7: Complete ────────────────────────────────────
        return {
            "status": "complete",
            "project_id": project_id,
            "lyrics_id": str(lyrics.id),
            "word_count": len(words_data),
            "line_count": max((w["line_index"] for w in words_data), default=0) + 1,
            "raw_transcription": result.raw_text,
            "tempo_bpm": beat_result.tempo_bpm,
            "total_beats": beat_result.total_beats,
        }

    except Exception as e:
        logger.exception("Transcription failed for project %s", project_id)
        db.rollback()
        raise
    finally:
        db.close()
