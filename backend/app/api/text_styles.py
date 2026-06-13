"""Text Styles API endpoints. Phase 10.

Provides endpoints to:
- List all available text styles
- Preview filter output for a given style + words
- Get info about a specific style
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.text_render_service import get_text_render_service

router = APIRouter(prefix="/text-styles", tags=["text-styles"])


class TextStyleInfoResponse(BaseModel):
    id: int
    name: str
    description: str
    category: str


class TextStyleListResponse(BaseModel):
    styles: list[TextStyleInfoResponse]
    total: int


class PreviewRequest(BaseModel):
    style_number: int = Field(..., ge=1, le=6)
    words: list[dict] = Field(
        ...,
        min_length=1,
        description="List of {word, start, end, line_index} dicts",
    )
    language: str = Field(default="en", pattern="^(en|hi_dev|hi_rom)$")
    duration: float = Field(default=30.0, ge=1.0, le=60.0)


class PreviewResponse(BaseModel):
    style_number: int
    style_name: str
    filter_string: str
    filter_count: int
    language: str


@router.get("", response_model=TextStyleListResponse)
async def list_text_styles() -> TextStyleListResponse:
    """List all available text styles with metadata."""
    service = get_text_render_service()
    styles = service.available_styles
    return TextStyleListResponse(
        styles=[TextStyleInfoResponse(**s) for s in styles],
        total=len(styles),
    )


@router.get("/{style_id}", response_model=TextStyleInfoResponse)
async def get_text_style(style_id: int) -> TextStyleInfoResponse:
    """Get info about a specific text style."""
    service = get_text_render_service()
    info = service.get_style_info(style_id)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Style {style_id} not found")
    return TextStyleInfoResponse(**info)


@router.post("/preview", response_model=PreviewResponse)
async def preview_text_style(data: PreviewRequest) -> PreviewResponse:
    """Generate a preview of the FFmpeg filter string for a style.

    Useful for debugging and validating that word timings will produce
    correct filter output before the full render pipeline (Phase 11).
    """
    service = get_text_render_service()

    if not service.validate_style(data.style_number):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid style number {data.style_number}. Available: 1-6",
        )

    # Validate words have required fields
    for i, w in enumerate(data.words):
        if "word" not in w or "start" not in w or "end" not in w:
            raise HTTPException(
                status_code=400,
                detail=f"Word {i} missing required fields (word, start, end)",
            )
        if "line_index" not in w:
            w["line_index"] = 0

    filter_str = service.render(
        style_number=data.style_number,
        words=data.words,
        language=data.language,
        duration=data.duration,
    )

    info = service.get_style_info(data.style_number)
    return PreviewResponse(
        style_number=data.style_number,
        style_name=info["name"] if info else "Unknown",
        filter_string=filter_str,
        filter_count=filter_str.count("drawtext=") if filter_str else 0,
        language=data.language,
    )
