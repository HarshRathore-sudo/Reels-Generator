# Backend Architecture

System design, data flow, services, and render pipeline documentation for the Doles Reels Generator backend.

---

## Table of Contents

- [System Overview](#system-overview)
- [Service Architecture](#service-architecture)
- [Database Schema](#database-schema)
- [Data Flow](#data-flow)
- [Backend Services](#backend-services)
- [Celery Workers](#celery-workers)
- [Render Pipeline](#render-pipeline)
- [Text Style System](#text-style-system)
- [Mock Mode Pattern](#mock-mode-pattern)
- [Error Handling Strategy](#error-handling-strategy)
- [Configuration](#configuration)

---

## System Overview

```
                    ┌──────────────────────────────────────┐
                    │              Nginx                    │
                    │         (Port 61278)                  │
                    │   /  -> frontend:5173                 │
                    │   /api -> backend:8000                │
                    └────────────┬─────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                                      ▼
     ┌──────────────┐                      ┌──────────────┐
     │   Frontend    │                      │   Backend    │
     │  React/Vite   │                      │   FastAPI    │
     │  Port 5173    │                      │  Port 8000   │
     └──────────────┘                      └──────┬───────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                    ┌──────────────┐      ┌──────────────┐    ┌──────────────┐
                    │  PostgreSQL  │      │    Redis      │    │ Cloudflare   │
                    │    16        │      │     7         │    │     R2       │
                    │  Port 5432   │      │  Port 6379    │    │  (Storage)   │
                    └──────────────┘      └──────┬───────┘    └──────────────┘
                                                  │
                                          ┌───────┴───────┐
                                          ▼               ▼
                                   ┌────────────┐  ┌────────────┐
                                   │   Celery   │  │   Celery   │
                                   │  Worker 1  │  │  Worker 2  │
                                   │ (render)   │  │ (render)   │
                                   └────────────┘  └────────────┘
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                        ┌──────────┐ ┌──────────┐ ┌──────────┐
                        │ Claude   │ │  Pexels  │ │ WhisperX │
                        │   API    │ │   API    │ │          │
                        └──────────┘ └──────────┘ └──────────┘
```

### Key Design Decisions

1. **Async FastAPI + Sync Celery**: The API server uses async SQLAlchemy (`asyncpg`) for non-blocking I/O. Celery workers use sync SQLAlchemy (`psycopg2-binary`) because Celery tasks run in synchronous threads.

2. **Singleton Services**: Services like `R2Service`, `ClaudeService`, and `PexelsService` use a singleton pattern via `@lru_cache` or module-level instances, initialized on first use.

3. **Two Database Engines**: `database.py` provides `AsyncSession` for FastAPI routes. `sync_database.py` provides `Session` for Celery workers. Both connect to the same PostgreSQL instance.

4. **Mock Mode by Default**: All external services (R2, Claude, Pexels, WhisperX) fall back to mock mode when API keys are not configured, enabling development without credentials.

---

## Service Architecture

```
app/
├── main.py                     Application entry point
│   ├── Exception handlers      Global error handling
│   ├── Request logging         Middleware for timing
│   └── CORS + Router setup
│
├── api/                        HTTP layer (thin controllers)
│   ├── __init__.py             Router registration
│   ├── projects.py             CRUD operations
│   ├── audio.py                Upload flow, FFmpeg trim, transcription dispatch
│   ├── lyrics.py               Word timing CRUD
│   ├── vibe.py                 Claude AI integration for vibe/keywords
│   ├── visual.py               Pexels clip pool management
│   ├── generation.py           Batch render orchestration
│   ├── text_styles.py          Style metadata + preview
│   └── jobs.py                 Celery task status polling
│
├── services/                   Business logic (stateless)
│   ├── r2_service.py           S3-compatible storage
│   ├── claude_service.py       Vibe suggestion, keyword extraction, clip ranking
│   ├── pexels_service.py       Video clip search
│   ├── ffmpeg_service.py       Video rendering with text overlays
│   ├── text_render_service.py  Style orchestration, font resolution
│   ├── librosa_service.py      Beat/tempo detection
│   ├── transcription_service.py Transcription orchestration
│   ├── whisperx_service.py     WhisperX model wrapper
│   └── ytdlp_service.py       Video download helper
│
├── workers/                    Background tasks (sync SQLAlchemy)
│   ├── celery_app.py           Celery configuration + broker
│   ├── render_worker.py        7-stage reel render pipeline
│   ├── transcription_worker.py Audio transcription task
│   └── pool_builder_worker.py  Pexels search + ranking task
│
├── text_styles/                FFmpeg drawtext filter generators
│   ├── base.py                 Abstract base style
│   ├── style_1_minimal_fade.py
│   ├── style_2_karaoke.py
│   ├── style_3_word_pop.py
│   ├── style_4_typewriter.py
│   ├── style_5_stacked.py
│   └── style_6_cinematic.py
│
├── models/                     ORM layer
│   └── db_models.py            5 tables: Project, AudioFile, Lyrics, ClipPool, GeneratedReel
│
├── schemas/                    Validation layer
│   ├── project.py              ProjectCreate (with validator), ProjectResponse
│   ├── audio.py                Upload, Trim, Transcribe, BeatDetection schemas
│   ├── lyrics.py               LyricsResponse, LyricsUpdateRequest
│   ├── vibe.py                 VibeRequest (with validator), KeywordsUpdateRequest
│   ├── visual.py               VisualMode, ClipPool schemas
│   └── generation.py           Render and batch response schemas
│
├── prompts/                    Claude API prompt templates
│   ├── vibe_suggestion.txt     Suggest vibe from lyrics+tempo
│   ├── keyword_extraction.txt  Extract visual search keywords
│   └── clip_ranking.txt        Rank clips by vibe relevance
│
└── core/                       Infrastructure
    ├── config.py               Pydantic Settings (env vars)
    ├── database.py             Async SQLAlchemy engine
    └── sync_database.py        Sync engine for Celery
```

---

## Database Schema

### Entity Relationship Diagram

```
projects (1) ──────── (N) audio_files
    │
    ├── (1) ──────── (N) lyrics
    │
    ├── (1) ──────── (N) clip_pool
    │                       │
    │                       └── (1) ── (N) generated_reels
    │
    └── (1) ──────── (N) generated_reels
```

### Tables

#### projects
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `name` | VARCHAR(255) | Project name |
| `status` | ENUM | `draft`, `transcribed`, `vibe_set`, `generating`, `complete` |
| `language` | ENUM | `hi_dev`, `hi_rom`, `en` (default: `hi_dev`) |
| `vibe_description` | TEXT | Free-text vibe description |
| `vibe_keywords` | JSON | Array of search keywords |
| `visual_mode` | ENUM | `stock` or `custom` |
| `custom_video_url` | VARCHAR(1024) | Custom video URL if mode=custom |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp (auto-update) |

#### audio_files
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `project_id` | UUID (FK) | References projects.id (CASCADE delete) |
| `original_url` | VARCHAR(1024) | R2 key for original upload |
| `trimmed_url` | VARCHAR(1024) | R2 key for trimmed segment |
| `duration_seconds` | FLOAT | Current audio duration |
| `beat_timestamps` | JSON | Array of beat times in seconds |
| `tempo_bpm` | FLOAT | Estimated tempo |
| `created_at` | DATETIME | Upload timestamp |

#### lyrics
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `project_id` | UUID (FK) | References projects.id (CASCADE delete) |
| `words` | JSON | Array of `{word, start, end, line_index}` |
| `raw_transcription` | TEXT | Plain text transcription |
| `last_edited_at` | DATETIME | Last edit timestamp (auto-update) |

#### clip_pool
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `project_id` | UUID (FK) | References projects.id (CASCADE delete) |
| `pexels_clip_id` | VARCHAR(255) | Pexels video ID |
| `clip_url` | VARCHAR(1024) | Direct video URL |
| `duration_seconds` | FLOAT | Clip duration |
| `width` | INTEGER | Video width |
| `height` | INTEGER | Video height |
| `relevance_score` | FLOAT | AI-ranked relevance (0.0-1.0) |
| `used` | BOOLEAN | Whether clip has been used |
| `used_at` | DATETIME | When clip was used |

#### generated_reels
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `project_id` | UUID (FK) | References projects.id (CASCADE delete) |
| `batch_number` | INTEGER | Batch sequence number |
| `text_style` | INTEGER | Style number (1-6) |
| `clip_pool_id` | UUID (FK) | References clip_pool.id |
| `output_url` | VARCHAR(1024) | R2 key for rendered MP4 |
| `render_status` | ENUM | `queued`, `rendering`, `complete`, `failed` |
| `render_started_at` | DATETIME | Render start time |
| `render_completed_at` | DATETIME | Render end time |
| `error_message` | TEXT | Error details if failed |

### Cascade Behavior

All child tables have `ondelete="CASCADE"` on their `project_id` foreign keys. Deleting a project removes all associated audio files, lyrics, clips, and reels automatically.

---

## Data Flow

### Audio Upload Flow

```
Browser                  API                    R2 Storage
  │                       │                        │
  │── GET upload-url ────>│                        │
  │<── presigned URL ─────│                        │
  │                       │                        │
  │── PUT file directly ──────────────────────────>│
  │<── 200 OK ────────────────────────────────────│
  │                       │                        │
  │── POST confirm ──────>│── verify exists ──────>│
  │<── AudioFile ─────────│<── exists ────────────│
```

### Transcription Flow

```
API                   Celery Worker              Services
  │                        │                        │
  │── dispatch task ──────>│                        │
  │<── job_id ─────────────│                        │
  │                        │── download audio ─────>│ R2
  │                        │<── audio bytes ────────│
  │                        │                        │
  │                        │── transcribe ─────────>│ WhisperX
  │                        │<── words[] ───────────│
  │                        │                        │
  │                        │── save to DB ─────────>│ PostgreSQL
  │                        │── update status ──────>│
  │                        │                        │
  │── poll job status ────>│                        │
  │<── {progress, status} ─│                        │
```

### Render Flow

```
API                   Celery Worker              Services
  │                        │                        │
  │── POST generate ─────>│                        │
  │   (creates 6 reels)   │                        │
  │   (dispatches 6 tasks)│                        │
  │<── batch_number ───────│                        │
  │                        │                        │
  │                        │── Stage 1: Load data ─>│ PostgreSQL
  │                        │── Stage 2: Get clip ──>│ R2/Pexels
  │                        │── Stage 3: Get audio ─>│ R2
  │                        │── Stage 4: Text style ─>│ TextRenderService
  │                        │── Stage 5: FFmpeg ─────>│ FFmpegService
  │                        │── Stage 6: Upload ─────>│ R2
  │                        │── Stage 7: Status ─────>│ PostgreSQL
  │                        │                        │
  │── poll batch-status ──>│                        │
  │<── {complete/fail} ────│                        │
```

---

## Backend Services

### R2Service (`r2_service.py`)

S3-compatible storage client for Cloudflare R2.

| Method | Description |
|--------|-------------|
| `generate_presigned_upload_url(file_key, content_type)` | Generate PUT presigned URL |
| `generate_presigned_download_url(file_key)` | Generate GET presigned URL |
| `upload_file_bytes(file_key, data, content_type)` | Upload bytes directly |
| `download_file_bytes(file_key)` | Download file as bytes |
| `delete_file(file_key)` | Delete a file |
| `file_exists(file_key)` | Check if file exists |

**Mock Mode**: When `R2_ACCOUNT_ID` is empty, returns fake URLs and simulates operations.

### ClaudeService (`claude_service.py`)

Anthropic Claude API integration for AI-powered features.

| Method | Description |
|--------|-------------|
| `suggest_vibe(tempo_bpm, lyrics_text, language)` | Generate vibe suggestion |
| `extract_keywords(vibe_description)` | Extract 5 visual search keywords |
| `rank_clips(clips, vibe_description)` | Rank clips by relevance (0-1) |

**Model**: `claude-sonnet-4-20250514`
**Mock Mode**: Returns preset suggestions and sample keywords when `ANTHROPIC_API_KEY` is empty.

### PexelsService (`pexels_service.py`)

Pexels Video API integration for stock video discovery.

| Method | Description |
|--------|-------------|
| `search_videos(query, per_page, orientation)` | Search for videos |
| `get_video(video_id)` | Get video details |

**Mock Mode**: Returns mock video metadata with placeholder URLs.

### FFmpegService (`ffmpeg_service.py`)

FFmpeg command builder for video compositing.

| Method | Description |
|--------|-------------|
| `render_reel_sync(video_path, audio_path, filter_string, output_path)` | Full reel render |

Builds complex `filter_complex` chains: scale -> crop -> fps -> trim -> setpts -> drawtext -> H.264+AAC encode.

**Output**: 1080x1920 vertical MP4, H.264 video, AAC audio, 30fps.

### TextRenderService (`text_render_service.py`)

Orchestrates the 6 text style renderers.

| Method | Description |
|--------|-------------|
| `render(style_number, words, language, duration)` | Generate FFmpeg filter string |
| `get_style_info(style_id)` | Get style metadata |
| `validate_style(style_number)` | Check if style exists |

**Font Resolution**: Maps language to font path:
- `en`, `hi_rom` -> `/app/fonts/Inter-Bold.ttf`
- `hi_dev` -> `/app/fonts/NotoSansDevanagari-Bold.ttf`

### LibrosaService (`librosa_service.py`)

Audio analysis using the Librosa library.

| Method | Description |
|--------|-------------|
| `detect_beats(audio_path, audio_duration)` | Detect beats and estimate tempo |

Returns `BeatResult` with `beat_timestamps`, `tempo_bpm`, and `total_beats`.

**Mock Mode**: Returns evenly-spaced beats at 120 BPM when audio file is empty.

---

## Celery Workers

### Configuration (`celery_app.py`)

```python
broker_url = settings.REDIS_URL        # Redis as message broker
result_backend = settings.REDIS_URL    # Redis as result store
task_acks_late = False                 # Ack immediately (Redis reliability)
worker_prefetch_multiplier = 4         # Pre-fetch 4 tasks per worker
task_serializer = "json"
result_serializer = "json"
```

**Concurrency**: 3 worker processes (configured in `docker-compose.yml`).

### render_reel (`render_worker.py`)

7-stage render pipeline for each reel:

| Stage | Description | Progress |
|-------|-------------|----------|
| 1 | Load project data (lyrics, audio, clip) from DB | 5% |
| 2 | Download video clip from Pexels/R2 | 15% |
| 3 | Download audio from R2 | 25% |
| 4 | Generate text overlay filter string | 35% |
| 5 | Run FFmpeg render (scale + crop + drawtext + encode) | 70% |
| 6 | Upload rendered MP4 to R2 | 90% |
| 7 | Update database status to complete | 100% |

**Error Handling**: On failure, sets `render_status=failed` and saves `error_message`. The task does not retry automatically.

**Progress Reporting**: Uses `self.update_state(state="PROGRESS", meta={"progress": N, "message": "..."})` for real-time tracking via the Jobs API.

### transcribe_audio_task (`transcription_worker.py`)

Transcription pipeline:

1. Download audio from R2
2. Run WhisperX transcription with language parameter
3. Parse word-level timing results
4. Save words to Lyrics table
5. Update project status to `transcribed`

### build_clip_pool_task (`pool_builder_worker.py`)

Clip pool construction:

1. Load project vibe keywords from DB
2. Search Pexels for each keyword (paginated)
3. Deduplicate clips by Pexels ID
4. Rank clips by vibe relevance via Claude AI
5. Save top clips to ClipPool table

---

## Render Pipeline

### FFmpeg Command Structure

The render pipeline generates an FFmpeg `filter_complex` command:

```bash
ffmpeg \
  -i video.mp4 \                      # Input video
  -i audio.mp3 \                      # Input audio
  -filter_complex "
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    fps=30,
    trim=duration=30,
    setpts=PTS-STARTPTS,
    drawtext=text='word1':fontfile=/app/fonts/Inter-Bold.ttf:...,
    drawtext=text='word2':fontfile=/app/fonts/Inter-Bold.ttf:...
    [v]
  " \
  -map "[v]" -map 1:a \               # Map filtered video + audio
  -c:v libx264 -preset medium \        # H.264 encoding
  -crf 23 \                           # Quality
  -c:a aac -b:a 128k \                # AAC audio
  -t 30 \                             # Duration limit
  -y output.mp4                       # Output file
```

### Text Overlay Animation

Each text style generates `drawtext` filter chains with:

- **`enable='between(t,start,end)'`** - Precise timing control
- **`alpha` expressions** - Fade in/out animations
- **`fontsize` expressions** - Scale animations (Word Pop style)
- **Position calculations** - Center, bottom, stacked placements

Example minimal fade filter:
```
drawtext=text='Hello':fontfile=/app/fonts/Inter-Bold.ttf:fontsize=72:fontcolor=white:
x=(w-text_w)/2:y=(h-text_h)/2:
enable='between(t,0.5,1.0)':
alpha='if(lt(t,0.6),10*(t-0.5),if(gt(t,0.9),10*(1.0-t),1))'
```

### Mock Render Mode

When video clips are unavailable (mock mode), the pipeline uses FFmpeg's `lavfi` color source:
```bash
ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=5 ...
```

This generates a 5-second black background video for testing.

---

## Text Style System

### Architecture

```
text_styles/
├── base.py                    Abstract base class
│   └── BaseTextStyle
│       ├── render(words, language, duration) -> str
│       ├── get_font_path(language) -> str
│       └── escape_text(text) -> str
│
├── style_1_minimal_fade.py    MinimalFadeStyle(BaseTextStyle)
├── style_2_karaoke.py         KaraokeHighlightStyle(BaseTextStyle)
├── style_3_word_pop.py        WordPopStyle(BaseTextStyle)
├── style_4_typewriter.py      TypewriterStyle(BaseTextStyle)
├── style_5_stacked.py         StackedLinesStyle(BaseTextStyle)
└── style_6_cinematic.py       CinematicSubtitleStyle(BaseTextStyle)
```

### Style Registration

Styles are registered in `text_styles/__init__.py`:
```python
STYLES = {
    1: MinimalFadeStyle,
    2: KaraokeHighlightStyle,
    3: WordPopStyle,
    4: TypewriterStyle,
    5: StackedLinesStyle,
    6: CinematicSubtitleStyle,
}
```

### Adding a New Style

1. Create `style_7_newstyle.py` extending `BaseTextStyle`
2. Implement `render(words, language, duration) -> str`
3. Register in `__init__.py` STYLES dict
4. Update `TOTAL_STYLES = 7` in `generation.py`
5. Add style info to `TextRenderService.STYLE_INFO`

---

## Mock Mode Pattern

Services follow a consistent mock mode pattern:

```python
class SomeService:
    def __init__(self):
        settings = get_settings()
        self.is_configured = bool(settings.SOME_API_KEY)

        if self.is_configured:
            self.client = RealClient(api_key=settings.SOME_API_KEY)
        else:
            self.client = None
            logger.warning("SomeService running in MOCK mode")

    def do_something(self, param):
        if not self.is_configured:
            return self._mock_do_something(param)
        return self.client.do_something(param)

    def _mock_do_something(self, param):
        return {"mock": True, "data": "sample"}
```

### When Mock Mode Activates

| Service | Trigger |
|---------|---------|
| R2 Storage | `R2_ACCOUNT_ID` is empty |
| Claude AI | `ANTHROPIC_API_KEY` is empty |
| Pexels | `PEXELS_API_KEY` is empty |
| WhisperX | Always available (local model), mock if audio empty |

---

## Error Handling Strategy

### API Layer (FastAPI)

1. **Global Exception Handlers** (`main.py`):
   - `RequestValidationError` -> 422 with readable field messages
   - `SQLAlchemyError` -> 500 with safe generic message
   - `Exception` -> 500 with safe generic message + full traceback in logs

2. **HTTP Exceptions**: Route handlers raise `HTTPException` for business logic errors (404, 400).

3. **Request Logging Middleware**: Logs all `/api` requests with method, path, status code, and response time in milliseconds.

### Worker Layer (Celery)

1. **Task-level try/except**: Render workers catch exceptions and set `render_status=failed` with error message in DB.
2. **No automatic retry**: Tasks fail once and report the error. Users can regenerate manually.
3. **Progress reporting**: Workers report progress via `self.update_state()` for real-time frontend tracking.

### Frontend Layer

1. **Axios Interceptor**: Retries GET requests (max 2 retries) on transient errors (502, 503, 504, 408).
2. **Toast Notifications**: Auto-show error toasts for 500+ errors and timeouts.
3. **Error Boundary**: React Error Boundary catches unhandled component errors with retry/go-home fallback.
4. **Poll Error Recovery**: After 10 consecutive polling failures, stops polling and shows a resume button.

---

## Configuration

### Environment Variables

All settings are loaded via Pydantic `BaseSettings` from `backend/.env`:

```python
class Settings(BaseSettings):
    DATABASE_URL: str          # PostgreSQL async connection
    REDIS_URL: str             # Redis broker URL
    R2_ACCOUNT_ID: str         # Cloudflare account ID
    R2_ACCESS_KEY_ID: str      # R2 access key
    R2_SECRET_ACCESS_KEY: str  # R2 secret key
    R2_BUCKET_NAME: str        # R2 bucket name
    R2_ENDPOINT: str           # R2 endpoint URL
    R2_PUBLIC_URL: str         # Optional public URL
    PEXELS_API_KEY: str        # Pexels API key
    ANTHROPIC_API_KEY: str     # Claude API key
    BACKEND_URL: str           # Backend URL for CORS
    FRONTEND_URL: str          # Frontend URL for CORS
```

Settings are cached via `@lru_cache()` and accessed through `get_settings()`.

### Database Engines

| Engine | Module | Driver | Used By |
|--------|--------|--------|---------|
| Async | `core/database.py` | `asyncpg` | FastAPI routes |
| Sync | `core/sync_database.py` | `psycopg2-binary` | Celery workers |

Both use the same `DATABASE_URL` but with different connection string prefixes:
- Async: `postgresql+asyncpg://...`
- Sync: `postgresql://...` (default psycopg2)
