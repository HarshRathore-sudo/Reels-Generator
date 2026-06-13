from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class WordSchema(BaseModel):
    word: str
    start: float
    end: float
    line_index: int


class LyricsResponse(BaseModel):
    id: UUID
    project_id: UUID
    words: list[WordSchema]
    raw_transcription: str | None = None
    last_edited_at: datetime

    model_config = {"from_attributes": True}


class LyricsUpdateRequest(BaseModel):
    words: list[WordSchema]
