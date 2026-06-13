"""Visual mode and clip pool request/response schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class VisualModeRequest(BaseModel):
    """Request to set the visual mode for a project."""
    mode: str = Field(..., pattern="^(stock|custom)$", description="Visual mode: 'stock' or 'custom'")


class CustomVideoRequest(BaseModel):
    """Request to submit a custom video URL."""
    url: str = Field(..., min_length=1, max_length=2048, description="Custom video URL")


class VisualModeResponse(BaseModel):
    """Response after setting the visual mode."""
    visual_mode: str
    custom_video_url: Optional[str] = None
    status: str


class BuildPoolResponse(BaseModel):
    """Response when starting a clip pool build job."""
    job_id: str
    message: str


class ClipPoolItemResponse(BaseModel):
    """Single clip pool item in the response."""
    id: UUID
    pexels_clip_id: str
    clip_url: str
    duration_seconds: float
    width: int
    height: int
    relevance_score: float
    used: bool

    model_config = {"from_attributes": True}


class ClipPoolResponse(BaseModel):
    """Response containing the project's clip pool."""
    clips: list[ClipPoolItemResponse]
    total: int
    visual_mode: Optional[str] = None
