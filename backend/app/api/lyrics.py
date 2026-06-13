"""Lyrics API endpoints.

Phase 5: GET lyrics (after transcription)
Phase 6: PUT lyrics (edit word timings in review dashboard)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models.db_models import Project, Lyrics
from app.schemas.lyrics import LyricsResponse, LyricsUpdateRequest

router = APIRouter(prefix="/projects/{project_id}/lyrics", tags=["lyrics"])


async def _get_project(project_id: UUID, db: AsyncSession) -> Project:
    """Helper to fetch project or raise 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_lyrics(project_id: UUID, db: AsyncSession) -> Lyrics:
    """Helper to fetch lyrics or raise 404."""
    result = await db.execute(
        select(Lyrics).where(Lyrics.project_id == project_id)
    )
    lyrics = result.scalar_one_or_none()
    if lyrics is None:
        raise HTTPException(
            status_code=404,
            detail="No lyrics found. Run transcription first.",
        )
    return lyrics


@router.get("", response_model=LyricsResponse)
async def get_lyrics(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> LyricsResponse:
    """Get the lyrics with word-level timing for a project.

    Returns word-level timing data from transcription.
    Each word has: word, start, end, line_index.
    """
    await _get_project(project_id, db)
    lyrics = await _get_lyrics(project_id, db)
    return LyricsResponse.model_validate(lyrics)


@router.put("", response_model=LyricsResponse)
async def update_lyrics(
    project_id: UUID,
    data: LyricsUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> LyricsResponse:
    """Update word timings or text for a project's lyrics.

    Used by the Lyrics Review Dashboard (Phase 6) to:
    - Edit word text
    - Adjust word timing (start/end)
    - Reorder or merge words
    - Change line assignments
    """
    await _get_project(project_id, db)
    lyrics = await _get_lyrics(project_id, db)

    # Validate word data
    words_data = [w.model_dump() for w in data.words]

    # Basic validation: ensure start < end for each word
    for i, w in enumerate(words_data):
        if w["end"] <= w["start"]:
            raise HTTPException(
                status_code=400,
                detail=f"Word {i} ('{w['word']}'): end must be greater than start",
            )

    # Update lyrics
    lyrics.words = words_data

    # Rebuild raw transcription from words
    lines: dict[int, list[str]] = {}
    for w in words_data:
        line_idx = w["line_index"]
        if line_idx not in lines:
            lines[line_idx] = []
        lines[line_idx].append(w["word"])

    lyrics.raw_transcription = "\n".join(
        " ".join(words) for _, words in sorted(lines.items())
    )

    await db.commit()
    await db.refresh(lyrics)

    return LyricsResponse.model_validate(lyrics)
