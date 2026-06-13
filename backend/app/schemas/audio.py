from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class UploadUrlRequest(BaseModel):
    filename: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    file_key: str


class ConfirmUploadRequest(BaseModel):
    file_key: str
    duration_seconds: float = Field(..., gt=0)


class TrimRequest(BaseModel):
    start_sec: float = Field(..., ge=0)
    end_sec: float = Field(..., gt=0)


class TranscribeRequest(BaseModel):
    language: str = Field(..., pattern="^(hi_dev|hi_rom|en)$")


class AudioFileResponse(BaseModel):
    id: UUID
    project_id: UUID
    original_url: str
    trimmed_url: Optional[str] = None
    duration_seconds: float
    beat_timestamps: Optional[list[float]] = None
    tempo_bpm: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BeatDetectionResponse(BaseModel):
    beat_timestamps: list[float]
    tempo_bpm: float
    total_beats: int
