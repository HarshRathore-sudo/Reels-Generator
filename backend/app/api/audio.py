"""Audio API endpoints.

Phase 3: upload-url and confirm (R2 integration)
Phase 4: trim (FFmpeg), download-url
Phase 5: transcribe (WhisperX)
Phase 7: beats (Librosa beat detection)
"""

import uuid
import asyncio
import logging
import os
import subprocess
import tempfile
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models.db_models import Project, AudioFile
from app.schemas.audio import (
    UploadUrlRequest,
    UploadUrlResponse,
    ConfirmUploadRequest,
    TrimRequest,
    AudioFileResponse,
    TranscribeRequest,
    BeatDetectionResponse,
)
from app.services.r2_service import R2Service, get_r2_service
from app.services.librosa_service import get_librosa_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects/{project_id}/audio", tags=["audio"])

# Allowed audio MIME types
ALLOWED_AUDIO_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".wma": "audio/x-ms-wma",
    ".webm": "audio/webm",
}

# Reel constraints
MAX_TRIM_DURATION = 30.0  # seconds


async def _get_project(project_id: UUID, db: AsyncSession) -> Project:
    """Helper to fetch project or raise 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_audio_file(project_id: UUID, db: AsyncSession) -> AudioFile:
    """Helper to fetch the project's audio file or raise 404."""
    result = await db.execute(
        select(AudioFile).where(AudioFile.project_id == project_id)
    )
    audio = result.scalar_one_or_none()
    if audio is None:
        raise HTTPException(status_code=404, detail="Audio file not found for this project")
    return audio


def _get_file_extension(file_key: str) -> str:
    """Extract file extension from a file key."""
    _, ext = os.path.splitext(file_key)
    return ext.lower() if ext else ".mp3"


async def _run_ffmpeg_trim(
    input_bytes: bytes,
    input_ext: str,
    start_sec: float,
    end_sec: float,
) -> bytes:
    """Run FFmpeg to extract a segment from audio bytes.

    Uses subprocess in a thread to avoid blocking the event loop.
    """
    duration = end_sec - start_sec

    def _do_trim() -> bytes:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, f"input{input_ext}")
            output_path = os.path.join(tmpdir, "output.mp3")

            # Write input
            with open(input_path, "wb") as f:
                f.write(input_bytes)

            # FFmpeg command: extract segment, re-encode to mp3
            cmd = [
                "ffmpeg",
                "-y",
                "-ss", str(start_sec),
                "-t", str(duration),
                "-i", input_path,
                "-vn",                    # no video
                "-acodec", "libmp3lame",  # MP3 output
                "-ab", "192k",            # 192kbps bitrate
                "-ar", "44100",           # 44.1kHz sample rate
                "-ac", "2",               # stereo
                output_path,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=120,  # 2 minute timeout
            )

            if result.returncode != 0:
                stderr = result.stderr.decode("utf-8", errors="replace")
                logger.error("FFmpeg trim failed: %s", stderr[-500:])
                raise RuntimeError(f"FFmpeg trim failed: {stderr[-200:]}")

            # Read output
            with open(output_path, "rb") as f:
                return f.read()

    # Run in thread pool to not block async event loop
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _do_trim)


# ──────────────────────────── Endpoints ────────────────────────────


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    project_id: UUID,
    data: UploadUrlRequest,
    db: AsyncSession = Depends(get_db),
    r2: R2Service = Depends(get_r2_service),
) -> UploadUrlResponse:
    """Get a presigned URL for direct-to-R2 audio upload from the browser.

    The frontend will:
    1. Call this endpoint to get a presigned PUT URL
    2. Upload the file directly to R2 using that URL
    3. Call /confirm to save the metadata
    """
    # Verify project exists
    await _get_project(project_id, db)

    # Validate file extension
    filename = data.filename.lower()
    ext = ""
    for e in ALLOWED_AUDIO_TYPES:
        if filename.endswith(e):
            ext = e
            break

    if not ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format. Allowed: {', '.join(ALLOWED_AUDIO_TYPES.keys())}",
        )

    content_type = ALLOWED_AUDIO_TYPES[ext]

    # Generate a unique file key: projects/{project_id}/audio/original_{uuid}{ext}
    file_uuid = uuid.uuid4().hex[:12]
    file_key = f"projects/{project_id}/audio/original_{file_uuid}{ext}"

    # Generate presigned upload URL
    upload_url = r2.generate_presigned_upload_url(
        file_key=file_key,
        content_type=content_type,
    )

    return UploadUrlResponse(upload_url=upload_url, file_key=file_key)


@router.post("/confirm", response_model=AudioFileResponse, status_code=201)
async def confirm_upload(
    project_id: UUID,
    data: ConfirmUploadRequest,
    db: AsyncSession = Depends(get_db),
    r2: R2Service = Depends(get_r2_service),
) -> AudioFileResponse:
    """Confirm that the audio file was uploaded successfully to R2.

    Called by the frontend after a successful direct upload.
    Creates an AudioFile record in the database.
    """
    # Verify project exists
    project = await _get_project(project_id, db)

    # Validate the file_key belongs to this project
    expected_prefix = f"projects/{project_id}/audio/"
    if not data.file_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=400,
            detail="File key does not belong to this project",
        )

    # Optionally verify file exists in R2 (skip in mock mode)
    if r2.is_configured and not r2.file_exists(data.file_key):
        raise HTTPException(
            status_code=400,
            detail="File not found in storage. Upload may have failed.",
        )

    # Check if project already has an audio file — replace it
    result = await db.execute(
        select(AudioFile).where(AudioFile.project_id == project_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Delete old file from R2
        if r2.is_configured:
            try:
                r2.delete_file(existing.original_url)
                if existing.trimmed_url:
                    r2.delete_file(existing.trimmed_url)
            except Exception:
                pass  # Best effort cleanup
        await db.delete(existing)
        await db.flush()

    # Create new audio file record
    audio_file = AudioFile(
        project_id=project_id,
        original_url=data.file_key,
        duration_seconds=data.duration_seconds,
    )
    db.add(audio_file)
    await db.commit()
    await db.refresh(audio_file)

    return AudioFileResponse.model_validate(audio_file)


@router.get("", response_model=AudioFileResponse)
async def get_audio(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> AudioFileResponse:
    """Get the audio file metadata for a project."""
    audio = await _get_audio_file(project_id, db)
    return AudioFileResponse.model_validate(audio)


@router.get("/download-url")
async def get_download_url(
    project_id: UUID,
    trimmed: bool = False,
    db: AsyncSession = Depends(get_db),
    r2: R2Service = Depends(get_r2_service),
) -> dict:
    """Get a presigned download URL for the audio file.

    Args:
        trimmed: If True, return the trimmed audio URL. Otherwise return original.

    Returns:
        {"download_url": "...", "file_key": "..."}
    """
    audio = await _get_audio_file(project_id, db)

    if trimmed and audio.trimmed_url:
        file_key = audio.trimmed_url
    else:
        file_key = audio.original_url

    download_url = r2.generate_presigned_download_url(file_key=file_key)

    return {"download_url": download_url, "file_key": file_key}


@router.post("/trim", response_model=AudioFileResponse)
async def trim_audio(
    project_id: UUID,
    data: TrimRequest,
    db: AsyncSession = Depends(get_db),
    r2: R2Service = Depends(get_r2_service),
) -> AudioFileResponse:
    """Extract a 30-second (max) segment from the uploaded audio via FFmpeg.

    Downloads the original from R2, trims with FFmpeg, uploads the trimmed
    version back to R2, and updates the AudioFile record.
    """
    audio = await _get_audio_file(project_id, db)

    # Validation
    if data.end_sec <= data.start_sec:
        raise HTTPException(
            status_code=400,
            detail="end_sec must be greater than start_sec",
        )

    trim_duration = data.end_sec - data.start_sec
    if trim_duration > MAX_TRIM_DURATION + 0.5:  # small tolerance
        raise HTTPException(
            status_code=400,
            detail=f"Trim duration ({trim_duration:.1f}s) exceeds maximum of {MAX_TRIM_DURATION}s",
        )

    if data.start_sec < 0:
        raise HTTPException(
            status_code=400,
            detail="start_sec cannot be negative",
        )

    if data.end_sec > audio.duration_seconds + 0.5:  # small tolerance
        raise HTTPException(
            status_code=400,
            detail=f"end_sec ({data.end_sec:.1f}s) exceeds audio duration ({audio.duration_seconds:.1f}s)",
        )

    # Step 1: Download original audio from R2
    logger.info("Downloading original audio for trim: %s", audio.original_url)
    original_bytes = r2.download_file_bytes(audio.original_url)

    if not original_bytes and not r2.is_configured:
        # Mock mode: create a mock trimmed result
        logger.info("Mock mode: simulating trim operation")
        trim_uuid = uuid.uuid4().hex[:12]
        trimmed_key = f"projects/{project_id}/audio/trimmed_{trim_uuid}.mp3"
        audio.trimmed_url = trimmed_key
        audio.duration_seconds = trim_duration
        await db.commit()
        await db.refresh(audio)
        return AudioFileResponse.model_validate(audio)

    # Step 2: Run FFmpeg trim
    input_ext = _get_file_extension(audio.original_url)
    logger.info(
        "Trimming audio: start=%.2f end=%.2f duration=%.2f",
        data.start_sec, data.end_sec, trim_duration,
    )

    try:
        trimmed_bytes = await _run_ffmpeg_trim(
            input_bytes=original_bytes,
            input_ext=input_ext,
            start_sec=data.start_sec,
            end_sec=data.end_sec,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during FFmpeg trim")
        raise HTTPException(status_code=500, detail="Audio trim failed unexpectedly")

    # Step 3: Upload trimmed file to R2
    trim_uuid = uuid.uuid4().hex[:12]
    trimmed_key = f"projects/{project_id}/audio/trimmed_{trim_uuid}.mp3"

    logger.info("Uploading trimmed audio (%d bytes) to: %s", len(trimmed_bytes), trimmed_key)
    r2.upload_file_bytes(
        file_key=trimmed_key,
        data=trimmed_bytes,
        content_type="audio/mpeg",
    )

    # Step 4: Delete old trimmed file if exists
    if audio.trimmed_url:
        try:
            r2.delete_file(audio.trimmed_url)
        except Exception:
            pass  # Best effort

    # Step 5: Update database record
    audio.trimmed_url = trimmed_key
    audio.duration_seconds = trim_duration
    await db.commit()
    await db.refresh(audio)

    logger.info("Audio trim complete for project %s: %.2fs segment", project_id, trim_duration)
    return AudioFileResponse.model_validate(audio)


@router.post("/transcribe")
async def transcribe_audio(
    project_id: UUID,
    data: TranscribeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start transcription job for the project's audio.

    Dispatches a Celery task that:
    1. Downloads the audio from R2
    2. Runs transcription (mock or WhisperX)
    3. Saves word-level timing to the Lyrics table
    4. Updates project status to 'transcribed'

    Returns the Celery task ID for progress polling via /jobs/{job_id}.
    """
    from app.workers.transcription_worker import transcribe_audio_task

    # Verify project exists and has audio
    await _get_project(project_id, db)
    await _get_audio_file(project_id, db)

    # Dispatch async Celery task
    task = transcribe_audio_task.delay(str(project_id), data.language)

    logger.info(
        "Dispatched transcription task %s for project %s (lang=%s)",
        task.id, project_id, data.language,
    )

    return {"job_id": task.id}


@router.post("/beats", response_model=BeatDetectionResponse)
async def detect_beats(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    r2: R2Service = Depends(get_r2_service),
) -> BeatDetectionResponse:
    """Run beat detection on the project's audio using librosa.

    Downloads the audio (trimmed if available, otherwise original),
    analyzes it with librosa to detect beats and estimate tempo,
    then saves results to the AudioFile record.

    Returns beat_timestamps and tempo_bpm.
    """
    audio = await _get_audio_file(project_id, db)

    # Use trimmed audio if available, otherwise original
    file_key = audio.trimmed_url or audio.original_url

    # Download audio from R2
    logger.info("Downloading audio for beat detection: %s", file_key)
    audio_bytes = r2.download_file_bytes(file_key)

    # Run beat detection in a thread pool (CPU-intensive)
    librosa_service = get_librosa_service()

    ext = os.path.splitext(file_key)[1] or ".mp3"

    async def _run_beat_detection() -> dict:
        def _detect():
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                if audio_bytes:
                    tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                result = librosa_service.detect_beats(
                    audio_path=tmp_path,
                    audio_duration=audio.duration_seconds,
                )
                return result.to_dict()
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _detect)

    try:
        beat_result = await _run_beat_detection()
    except Exception as e:
        logger.exception("Beat detection failed for project %s", project_id)
        raise HTTPException(
            status_code=500,
            detail=f"Beat detection failed: {str(e)}",
        )

    # Save to database
    audio.beat_timestamps = beat_result["beat_timestamps"]
    audio.tempo_bpm = beat_result["tempo_bpm"]
    await db.commit()
    await db.refresh(audio)

    logger.info(
        "Beat detection complete for project %s: %.1f BPM, %d beats",
        project_id, beat_result["tempo_bpm"], beat_result["total_beats"],
    )

    return BeatDetectionResponse(
        beat_timestamps=beat_result["beat_timestamps"],
        tempo_bpm=beat_result["tempo_bpm"],
        total_beats=beat_result["total_beats"],
    )
