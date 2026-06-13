"""Vibe and Keywords request/response schemas."""

from pydantic import BaseModel, Field, field_validator


class VibeRequest(BaseModel):
    """Request to set a vibe description for a project."""
    vibe_description: str = Field(..., min_length=1, max_length=500)

    @field_validator("vibe_description")
    @classmethod
    def validate_vibe(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Vibe description cannot be empty")
        return v


class VibeResponse(BaseModel):
    """Response after setting a vibe description."""
    vibe_description: str
    keywords: list[str]
    status: str


class VibeSuggestResponse(BaseModel):
    """Response from AI vibe suggestion."""
    suggestion: str


class KeywordsResponse(BaseModel):
    """Response containing current keywords."""
    keywords: list[str]


class KeywordsUpdateRequest(BaseModel):
    """Request to update keywords manually."""
    keywords: list[str] = Field(..., min_length=3, max_length=10)
