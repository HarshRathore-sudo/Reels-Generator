import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSON
import enum

from app.core.database import Base


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    TRANSCRIBED = "transcribed"
    VIBE_SET = "vibe_set"
    GENERATING = "generating"
    COMPLETE = "complete"


class Language(str, enum.Enum):
    HI_DEV = "hi_dev"
    HI_ROM = "hi_rom"
    EN = "en"


class VisualMode(str, enum.Enum):
    STOCK = "stock"
    CUSTOM = "custom"


class RenderStatus(str, enum.Enum):
    QUEUED = "queued"
    RENDERING = "rendering"
    COMPLETE = "complete"
    FAILED = "failed"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    status: Mapped[str] = mapped_column(
        SAEnum(ProjectStatus, name="project_status"),
        default=ProjectStatus.DRAFT,
    )
    vibe_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    vibe_keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)
    language: Mapped[str] = mapped_column(
        SAEnum(Language, name="language"),
        default=Language.HI_DEV,
    )
    visual_mode: Mapped[str | None] = mapped_column(
        SAEnum(VisualMode, name="visual_mode"), nullable=True
    )
    custom_video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Relationships
    audio_files: Mapped[list["AudioFile"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    lyrics: Mapped[list["Lyrics"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    clip_pool: Mapped[list["ClipPool"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    generated_reels: Mapped[list["GeneratedReel"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class AudioFile(Base):
    __tablename__ = "audio_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )
    original_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    trimmed_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    beat_timestamps: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tempo_bpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="audio_files")


class Lyrics(Base):
    __tablename__ = "lyrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )
    words: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    raw_transcription: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_edited_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="lyrics")


class ClipPool(Base):
    __tablename__ = "clip_pool"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )
    pexels_clip_id: Mapped[str] = mapped_column(String(255), nullable=False)
    clip_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="clip_pool")
    generated_reels: Mapped[list["GeneratedReel"]] = relationship(
        back_populates="clip_pool_item"
    )


class GeneratedReel(Base):
    __tablename__ = "generated_reels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE")
    )
    batch_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text_style: Mapped[int] = mapped_column(Integer, nullable=False)
    clip_pool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clip_pool.id"), nullable=True
    )
    output_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    render_status: Mapped[str] = mapped_column(
        SAEnum(RenderStatus, name="render_status"),
        default=RenderStatus.QUEUED,
    )
    render_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    render_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="generated_reels")
    clip_pool_item: Mapped["ClipPool | None"] = relationship(
        back_populates="generated_reels"
    )
