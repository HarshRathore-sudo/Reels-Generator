"""Generation API endpoints for triggering reel renders and checking status.

Phase 11: Provides render-single endpoint for testing the render worker.
Phase 12: Full generate endpoint that creates 6 reels per batch,
           zip download, and project status management.
"""

import io
import logging
import zipfile
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.db_models import (
    AudioFile,
    ClipPool,
    GeneratedReel,
    Lyrics,
    Project,
    ProjectStatus,
    RenderStatus,
)
from app.services.r2_service import get_r2_service
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["generation"])

# Total number of text styles (one reel per style in a batch)
TOTAL_STYLES = 6


# ── Request/Response schemas ────────────────────────────────────

class RenderSingleRequest(BaseModel):
    """Request to render a single test reel."""
    text_style: int = Field(ge=1, le=6, description="Text style number (1-6)")
    clip_pool_id: str | None = Field(None, description="Optional clip pool ID to use")


class RenderSingleResponse(BaseModel):
    """Response after queuing a single render."""
    reel_id: str
    job_id: str
    text_style: int
    render_status: str
    message: str


class GenerateBatchResponse(BaseModel):
    """Response after queuing a full batch of 6 reels."""
    batch_number: int
    reel_ids: list[str]
    job_ids: list[str]
    total: int
    message: str


class ReelStatusResponse(BaseModel):
    """Status of a single reel."""
    reel_id: str
    project_id: str
    text_style: int
    render_status: str
    output_url: str | None
    error_message: str | None
    render_started_at: str | None
    render_completed_at: str | None
    batch_number: int


class ReelListResponse(BaseModel):
    """List of reels for a project."""
    project_id: str
    reels: list[ReelStatusResponse]
    total: int


class BatchStatusResponse(BaseModel):
    """Aggregated status of a batch of reels."""
    project_id: str
    batch_number: int
    total: int
    queued: int
    rendering: int
    complete: int
    failed: int
    all_complete: bool
    reels: list[ReelStatusResponse]


# ── Helper ──────────────────────────────────────────────────────

async def _get_project(project_id: UUID, db: AsyncSession) -> Project:
    """Fetch project or raise 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _reel_to_dict(r: GeneratedReel) -> dict:
    """Convert a GeneratedReel ORM object to a response dict."""
    status_val = r.render_status.value if hasattr(r.render_status, "value") else str(r.render_status)
    return {
        "reel_id": str(r.id),
        "project_id": str(r.project_id),
        "text_style": r.text_style,
        "render_status": status_val,
        "output_url": r.output_url,
        "error_message": r.error_message,
        "render_started_at": r.render_started_at.isoformat() if r.render_started_at else None,
        "render_completed_at": r.render_completed_at.isoformat() if r.render_completed_at else None,
        "batch_number": r.batch_number,
    }


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/render-single", response_model=RenderSingleResponse)
async def render_single_reel(
    project_id: UUID,
    data: RenderSingleRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Queue a single reel render for testing the render pipeline.

    Creates a GeneratedReel record and dispatches a Celery render task.
    This is the Phase 11 test endpoint. Full batch generation via /generate.

    Args:
        project_id: UUID of the project
        data: Request with text_style and optional clip_pool_id
    """
    project = await _get_project(project_id, db)

    # Check lyrics exist
    lyrics_result = await db.execute(
        select(Lyrics).where(Lyrics.project_id == project_id)
    )
    lyrics = lyrics_result.scalar_one_or_none()
    if not lyrics or not lyrics.words:
        raise HTTPException(
            status_code=400,
            detail="Project has no lyrics. Complete transcription first.",
        )

    # Resolve clip pool item
    clip_pool_id = None
    if data.clip_pool_id:
        clip_item = await db.get(ClipPool, UUID(data.clip_pool_id))
        if not clip_item:
            raise HTTPException(status_code=404, detail="Clip pool item not found")
        clip_pool_id = clip_item.id
    else:
        # Auto-select the highest-relevance unused clip
        clip_result = await db.execute(
            select(ClipPool)
            .where(ClipPool.project_id == project_id)
            .where(ClipPool.used == False)  # noqa: E712
            .order_by(ClipPool.relevance_score.desc())
            .limit(1)
        )
        clip_item = clip_result.scalar_one_or_none()
        if clip_item:
            clip_pool_id = clip_item.id

    # Determine batch number
    batch_result = await db.execute(
        select(GeneratedReel.batch_number)
        .where(GeneratedReel.project_id == project_id)
        .order_by(GeneratedReel.batch_number.desc())
        .limit(1)
    )
    last_batch = batch_result.scalar_one_or_none()
    batch_number = (last_batch or 0) + 1

    # Create the reel record
    reel = GeneratedReel(
        project_id=project_id,
        batch_number=batch_number,
        text_style=data.text_style,
        clip_pool_id=clip_pool_id,
        render_status=RenderStatus.QUEUED,
    )
    db.add(reel)
    await db.commit()
    await db.refresh(reel)

    reel_id = str(reel.id)

    # Dispatch Celery render task
    task = celery_app.send_task("render_reel", args=[reel_id])
    logger.info(
        "Queued render task %s for reel %s (style %d)",
        task.id, reel_id, data.text_style,
    )

    return {
        "reel_id": reel_id,
        "job_id": task.id,
        "text_style": data.text_style,
        "render_status": "queued",
        "message": f"Render queued for style {data.text_style}. "
                   f"Poll /api/jobs/{task.id} for progress.",
    }


@router.post("/generate", response_model=GenerateBatchResponse)
async def generate_reels(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a full batch of 6 reels (one per text style).

    Creates 6 GeneratedReel records and dispatches 6 Celery render tasks.
    Each reel gets a different text style (1-6) and is assigned a clip
    from the pool (highest relevance first, cycling if fewer clips than 6).

    The project status is updated to 'generating' while renders are in progress.

    Args:
        project_id: UUID of the project
    """
    project = await _get_project(project_id, db)

    # Validate prerequisites
    lyrics_result = await db.execute(
        select(Lyrics).where(Lyrics.project_id == project_id)
    )
    lyrics = lyrics_result.scalar_one_or_none()
    if not lyrics or not lyrics.words:
        raise HTTPException(
            status_code=400,
            detail="Project has no lyrics. Complete transcription first.",
        )

    # Check audio exists
    audio_result = await db.execute(
        select(AudioFile).where(AudioFile.project_id == project_id)
    )
    audio = audio_result.scalar_one_or_none()
    if not audio:
        raise HTTPException(
            status_code=400,
            detail="Project has no audio file. Upload audio first.",
        )

    # Determine batch number (increment from last)
    batch_result = await db.execute(
        select(func.max(GeneratedReel.batch_number))
        .where(GeneratedReel.project_id == project_id)
    )
    last_batch = batch_result.scalar_one_or_none()
    batch_number = (last_batch or 0) + 1

    # Get available clips from pool, sorted by relevance
    clips_result = await db.execute(
        select(ClipPool)
        .where(ClipPool.project_id == project_id)
        .order_by(ClipPool.relevance_score.desc())
    )
    all_clips = clips_result.scalars().all()

    # Create 6 reels, one per text style
    reel_ids: list[str] = []
    job_ids: list[str] = []

    for style_num in range(1, TOTAL_STYLES + 1):
        # Assign clip: cycle through available clips
        clip_pool_id = None
        if all_clips:
            clip_index = (style_num - 1) % len(all_clips)
            clip_pool_id = all_clips[clip_index].id

        reel = GeneratedReel(
            project_id=project_id,
            batch_number=batch_number,
            text_style=style_num,
            clip_pool_id=clip_pool_id,
            render_status=RenderStatus.QUEUED,
        )
        db.add(reel)
        await db.flush()  # Get the ID without committing

        reel_id = str(reel.id)
        reel_ids.append(reel_id)

        # Dispatch Celery render task
        task = celery_app.send_task("render_reel", args=[reel_id])
        job_ids.append(task.id)

        logger.info(
            "Queued batch render: reel=%s style=%d batch=%d job=%s",
            reel_id, style_num, batch_number, task.id,
        )

    # Update project status to generating
    project.status = ProjectStatus.GENERATING
    await db.commit()

    logger.info(
        "Generated batch %d for project %s: %d reels queued",
        batch_number, str(project_id), len(reel_ids),
    )

    return {
        "batch_number": batch_number,
        "reel_ids": reel_ids,
        "job_ids": job_ids,
        "total": len(reel_ids),
        "message": f"Batch {batch_number}: {len(reel_ids)} reels queued for rendering. "
                   f"Poll /api/projects/{project_id}/batch-status/{batch_number} for progress.",
    }


@router.get("/batch-status/{batch_number}", response_model=BatchStatusResponse)
async def get_batch_status(
    project_id: UUID,
    batch_number: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get aggregated status of all reels in a batch.

    Returns counts by status and whether all reels are complete.
    Used by frontend to poll batch progress.

    Args:
        project_id: UUID of the project
        batch_number: Batch number to check
    """
    await _get_project(project_id, db)

    result = await db.execute(
        select(GeneratedReel)
        .where(GeneratedReel.project_id == project_id)
        .where(GeneratedReel.batch_number == batch_number)
        .order_by(GeneratedReel.text_style)
    )
    reels = result.scalars().all()

    if not reels:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Count statuses
    counts = {"queued": 0, "rendering": 0, "complete": 0, "failed": 0}
    for r in reels:
        status = r.render_status.value if hasattr(r.render_status, "value") else str(r.render_status)
        if status in counts:
            counts[status] += 1

    all_done = counts["complete"] + counts["failed"] == len(reels)

    # If all are done and at least one is complete, update project status
    if all_done and counts["complete"] > 0:
        project_result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = project_result.scalar_one_or_none()
        if project and project.status != ProjectStatus.COMPLETE:
            project.status = ProjectStatus.COMPLETE
            await db.commit()

    return {
        "project_id": str(project_id),
        "batch_number": batch_number,
        "total": len(reels),
        "queued": counts["queued"],
        "rendering": counts["rendering"],
        "complete": counts["complete"],
        "failed": counts["failed"],
        "all_complete": all_done,
        "reels": [_reel_to_dict(r) for r in reels],
    }


@router.get("/reels", response_model=ReelListResponse)
async def list_reels(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all generated reels for a project.

    Returns reels ordered by batch number descending (newest first).
    """
    await _get_project(project_id, db)

    result = await db.execute(
        select(GeneratedReel)
        .where(GeneratedReel.project_id == project_id)
        .order_by(GeneratedReel.batch_number.desc(), GeneratedReel.text_style)
    )
    reels = result.scalars().all()

    return {
        "project_id": str(project_id),
        "reels": [_reel_to_dict(r) for r in reels],
        "total": len(reels),
    }


@router.get("/reels/{reel_id}", response_model=ReelStatusResponse)
async def get_reel(
    project_id: UUID,
    reel_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get single reel details including render status and output URL."""
    reel = await db.get(GeneratedReel, reel_id)
    if not reel or reel.project_id != project_id:
        raise HTTPException(status_code=404, detail="Reel not found")

    return _reel_to_dict(reel)


@router.get("/download-zip")
async def download_zip(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Download all completed reels from the latest batch as a zip file.

    Creates an in-memory zip archive containing all completed reel MP4s
    from the most recent batch. Each file is named by its text style number.

    Returns:
        StreamingResponse with application/zip content type
    """
    project = await _get_project(project_id, db)

    # Get the latest batch number
    batch_result = await db.execute(
        select(func.max(GeneratedReel.batch_number))
        .where(GeneratedReel.project_id == project_id)
    )
    latest_batch = batch_result.scalar_one_or_none()

    if not latest_batch:
        raise HTTPException(
            status_code=404,
            detail="No reels found for this project",
        )

    # Get completed reels from latest batch
    result = await db.execute(
        select(GeneratedReel)
        .where(GeneratedReel.project_id == project_id)
        .where(GeneratedReel.batch_number == latest_batch)
        .where(GeneratedReel.render_status == RenderStatus.COMPLETE)
        .order_by(GeneratedReel.text_style)
    )
    completed_reels = result.scalars().all()

    if not completed_reels:
        raise HTTPException(
            status_code=400,
            detail="No completed reels available for download",
        )

    # Build zip in memory
    r2_service = get_r2_service()
    zip_buffer = io.BytesIO()

    project_name = project.name.replace(" ", "_").replace("/", "_")[:50]

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for reel in completed_reels:
            if not reel.output_url:
                continue

            # Extract the R2 key from the output URL
            r2_key = f"projects/{reel.project_id}/reels/{reel.id}.mp4"

            try:
                # Download the file from R2
                file_data = r2_service.download_file_bytes(r2_key)
                if file_data:
                    filename = f"{project_name}_style{reel.text_style}_reel.mp4"
                    zf.writestr(filename, file_data)
                    logger.info("Added %s to zip (%d bytes)", filename, len(file_data))
                else:
                    logger.warning(
                        "Empty data for reel %s (R2 mock mode), skipping",
                        str(reel.id),
                    )
            except Exception as e:
                logger.warning(
                    "Failed to download reel %s for zip: %s",
                    str(reel.id), e,
                )

    zip_buffer.seek(0)
    zip_size = zip_buffer.getbuffer().nbytes

    if zip_size == 0:
        raise HTTPException(
            status_code=500,
            detail="Failed to create zip file - no files could be downloaded",
        )

    zip_filename = f"{project_name}_reels_batch{latest_batch}.zip"

    logger.info(
        "Serving zip download: %s (%d bytes, %d reels)",
        zip_filename, zip_size, len(completed_reels),
    )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "Content-Length": str(zip_size),
        },
    )
