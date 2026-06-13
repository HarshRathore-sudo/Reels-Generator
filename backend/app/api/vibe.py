"""Vibe and Keywords API endpoints.

Phase 8:
- POST /vibe       — Set vibe description + auto-extract keywords via Claude
- POST /vibe/suggest — AI-suggest vibe based on lyrics + audio metadata
- GET  /keywords    — Get current visual keywords
- PUT  /keywords    — Update keywords manually
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models.db_models import Project, AudioFile, Lyrics, ProjectStatus
from app.schemas.vibe import (
    VibeRequest,
    VibeResponse,
    VibeSuggestResponse,
    KeywordsResponse,
    KeywordsUpdateRequest,
)
from app.services.claude_service import get_claude_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects/{project_id}", tags=["vibe"])


async def _get_project(project_id: UUID, db: AsyncSession) -> Project:
    """Helper to fetch project or raise 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_audio(project_id: UUID, db: AsyncSession) -> AudioFile | None:
    """Helper to fetch the project's audio file (may be None)."""
    result = await db.execute(
        select(AudioFile).where(AudioFile.project_id == project_id)
    )
    return result.scalar_one_or_none()


async def _get_lyrics(project_id: UUID, db: AsyncSession) -> Lyrics | None:
    """Helper to fetch the project's lyrics (may be None)."""
    result = await db.execute(
        select(Lyrics).where(Lyrics.project_id == project_id)
    )
    return result.scalar_one_or_none()


@router.post("/vibe", response_model=VibeResponse)
async def set_vibe(
    project_id: UUID,
    data: VibeRequest,
    db: AsyncSession = Depends(get_db),
) -> VibeResponse:
    """Set vibe description and auto-extract visual keywords.

    1. Saves the vibe description to the project.
    2. Uses Claude to extract 5 visual search keywords from the vibe.
    3. Updates project status to 'vibe_set'.

    This is the main step that transitions the project from
    'transcribed' to 'vibe_set' status.
    """
    project = await _get_project(project_id, db)

    # Save vibe description
    project.vibe_description = data.vibe_description

    # Extract keywords from the vibe description via Claude
    claude_service = get_claude_service()
    try:
        keywords = await claude_service.extract_keywords(data.vibe_description)
    except Exception as e:
        logger.warning("Keyword extraction failed, using fallback: %s", e)
        # Provide basic fallback keywords from the vibe text
        words = data.vibe_description.replace(",", " ").split()
        keywords = [w.strip() for w in words if len(w.strip()) > 2][:5]
        if len(keywords) < 3:
            keywords = ["cinematic", "aesthetic", "mood", "vibes", "atmosphere"]

    project.vibe_keywords = keywords
    project.status = ProjectStatus.VIBE_SET

    await db.commit()
    await db.refresh(project)

    logger.info(
        "Vibe set for project %s: '%s' -> keywords=%s",
        project_id, data.vibe_description[:50], keywords,
    )

    return VibeResponse(
        vibe_description=project.vibe_description,
        keywords=keywords,
        status=project.status.value if hasattr(project.status, "value") else str(project.status),
    )


@router.post("/vibe/suggest", response_model=VibeSuggestResponse)
async def suggest_vibe(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> VibeSuggestResponse:
    """AI-suggest a vibe description based on audio metadata and lyrics.

    Uses the project's:
    - Tempo (BPM) from beat detection
    - Lyrics text from transcription
    - Language setting

    Returns a suggested vibe string that the user can edit before saving.
    """
    project = await _get_project(project_id, db)

    # Gather audio metadata
    audio = await _get_audio(project_id, db)
    tempo_bpm = 120.0  # Default
    if audio and audio.tempo_bpm:
        tempo_bpm = audio.tempo_bpm

    # Gather lyrics text
    lyrics = await _get_lyrics(project_id, db)
    lyrics_text = ""
    if lyrics and lyrics.raw_transcription:
        lyrics_text = lyrics.raw_transcription

    # Get language from project
    language = project.language if hasattr(project.language, "value") else str(project.language)
    # Handle enum value
    if hasattr(language, "value"):
        language = language.value

    # Call Claude for suggestion
    claude_service = get_claude_service()
    try:
        suggestion = await claude_service.suggest_vibe(
            tempo_bpm=tempo_bpm,
            lyrics_text=lyrics_text,
            language=language,
        )
    except Exception as e:
        logger.error("Vibe suggestion failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate vibe suggestion: {str(e)}",
        )

    logger.info("Vibe suggestion for project %s: '%s'", project_id, suggestion)

    return VibeSuggestResponse(suggestion=suggestion)


@router.get("/keywords", response_model=KeywordsResponse)
async def get_keywords(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> KeywordsResponse:
    """Get the current visual keywords for the project.

    Returns an empty list if no keywords have been set yet.
    """
    project = await _get_project(project_id, db)

    keywords = project.vibe_keywords or []

    return KeywordsResponse(keywords=keywords)


@router.put("/keywords", response_model=KeywordsResponse)
async def update_keywords(
    project_id: UUID,
    data: KeywordsUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> KeywordsResponse:
    """Update the visual keywords manually.

    Allows the user to add, remove, or edit keywords
    after they've been auto-extracted. Min 3, max 10 keywords.
    """
    project = await _get_project(project_id, db)

    # Clean keywords
    cleaned = [k.strip() for k in data.keywords if k.strip()]
    if len(cleaned) < 3:
        raise HTTPException(
            status_code=400,
            detail="At least 3 keywords are required",
        )

    project.vibe_keywords = cleaned[:10]
    await db.commit()
    await db.refresh(project)

    logger.info(
        "Keywords updated for project %s: %s",
        project_id, cleaned[:10],
    )

    return KeywordsResponse(keywords=project.vibe_keywords)
