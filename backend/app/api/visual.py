"""Visual mode and clip pool API endpoints.

Phase 9:
- POST /visual-mode     — Set stock or custom visual mode
- POST /custom-video    — Submit custom video URL
- POST /clips/build-pool — Start Celery task to build clip pool from Pexels
- GET  /clips           — Get clip pool for the project
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models.db_models import Project, ClipPool, VisualMode
from app.schemas.visual import (
    VisualModeRequest,
    CustomVideoRequest,
    VisualModeResponse,
    BuildPoolResponse,
    ClipPoolItemResponse,
    ClipPoolResponse,
)
from app.workers.pool_builder_worker import build_clip_pool_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects/{project_id}", tags=["visual"])


async def _get_project(project_id: UUID, db: AsyncSession) -> Project:
    """Helper to fetch project or raise 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/visual-mode", response_model=VisualModeResponse)
async def set_visual_mode(
    project_id: UUID,
    data: VisualModeRequest,
    db: AsyncSession = Depends(get_db),
) -> VisualModeResponse:
    """Set the visual mode for the project.

    - 'stock': will use Pexels stock videos (clip pool)
    - 'custom': user will provide their own video URL
    """
    project = await _get_project(project_id, db)

    # Validate mode
    try:
        mode = VisualMode(data.mode)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid visual mode. Must be 'stock' or 'custom'.",
        )

    project.visual_mode = mode

    # If switching to stock, clear custom video URL
    if mode == VisualMode.STOCK:
        project.custom_video_url = None

    await db.commit()
    await db.refresh(project)

    logger.info("Visual mode set to '%s' for project %s", data.mode, project_id)

    return VisualModeResponse(
        visual_mode=data.mode,
        custom_video_url=project.custom_video_url,
        status=project.status.value if hasattr(project.status, "value") else str(project.status),
    )


@router.post("/custom-video", response_model=VisualModeResponse)
async def submit_custom_video(
    project_id: UUID,
    data: CustomVideoRequest,
    db: AsyncSession = Depends(get_db),
) -> VisualModeResponse:
    """Submit a custom video URL for the project.

    Automatically sets visual_mode to 'custom'.
    """
    project = await _get_project(project_id, db)

    project.visual_mode = VisualMode.CUSTOM
    project.custom_video_url = data.url

    await db.commit()
    await db.refresh(project)

    logger.info("Custom video URL set for project %s: %s", project_id, data.url[:100])

    return VisualModeResponse(
        visual_mode="custom",
        custom_video_url=project.custom_video_url,
        status=project.status.value if hasattr(project.status, "value") else str(project.status),
    )


@router.post("/clips/build-pool", response_model=BuildPoolResponse)
async def build_clip_pool(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> BuildPoolResponse:
    """Start a Celery task to build the clip pool from Pexels.

    Uses the project's vibe_keywords to search for stock video clips,
    then ranks them by relevance to the vibe description.

    Requires project to have vibe_keywords set (Phase 8).
    """
    project = await _get_project(project_id, db)

    # Ensure project has keywords
    if not project.vibe_keywords or len(project.vibe_keywords) < 1:
        raise HTTPException(
            status_code=400,
            detail="Project must have vibe keywords set before building clip pool. Complete the Vibe step first.",
        )

    # Set visual mode to stock
    project.visual_mode = VisualMode.STOCK
    await db.commit()

    # Start Celery task
    task = build_clip_pool_task.delay(str(project_id))

    logger.info(
        "Clip pool build started for project %s (job_id=%s, keywords=%s)",
        project_id, task.id, project.vibe_keywords,
    )

    return BuildPoolResponse(
        job_id=task.id,
        message="Clip pool build started. Poll job status for progress.",
    )


@router.get("/clips", response_model=ClipPoolResponse)
async def get_clip_pool(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ClipPoolResponse:
    """Get the clip pool for the project.

    Returns all clips sorted by relevance score (highest first).
    """
    project = await _get_project(project_id, db)

    result = await db.execute(
        select(ClipPool)
        .where(ClipPool.project_id == project_id)
        .order_by(ClipPool.relevance_score.desc())
    )
    clips = result.scalars().all()

    clip_responses = [
        ClipPoolItemResponse(
            id=clip.id,
            pexels_clip_id=clip.pexels_clip_id,
            clip_url=clip.clip_url,
            duration_seconds=clip.duration_seconds,
            width=clip.width,
            height=clip.height,
            relevance_score=clip.relevance_score,
            used=clip.used,
        )
        for clip in clips
    ]

    visual_mode = None
    if project.visual_mode:
        visual_mode = project.visual_mode.value if hasattr(project.visual_mode, "value") else str(project.visual_mode)

    return ClipPoolResponse(
        clips=clip_responses,
        total=len(clip_responses),
        visual_mode=visual_mode,
    )
