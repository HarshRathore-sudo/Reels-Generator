"""Generation request/response schemas.

Visual mode schemas moved to visual.py in Phase 9.
"""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional


class GenerateResponse(BaseModel):
    batch_id: str
    job_ids: list[str]


class ReelResponse(BaseModel):
    id: UUID
    project_id: UUID
    batch_number: int
    text_style: int
    clip_pool_id: Optional[UUID] = None
    output_url: Optional[str] = None
    render_status: str
    render_started_at: Optional[datetime] = None
    render_completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: float = 0.0
    message: Optional[str] = None
    result: Optional[dict] = None
