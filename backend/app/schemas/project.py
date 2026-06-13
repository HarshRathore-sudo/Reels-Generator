from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Project name cannot be empty")
        if len(v) > 100:
            raise ValueError("Project name must be 100 characters or less")
        return v


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    status: str
    vibe_description: Optional[str] = None
    vibe_keywords: Optional[list[str]] = None
    language: str
    visual_mode: Optional[str] = None
    custom_video_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
