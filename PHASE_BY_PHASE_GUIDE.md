# Doles Reels Generator - Phase-by-Phase Build Guide

A complete step-by-step walkthrough for building the Doles Reels Generator from scratch. Each phase includes what it is, what you build, the files involved, and how to test it.

---

## Table of Contents

- [Prerequisites & Initial Setup](#prerequisites--initial-setup)
- [Phase 1: Project Scaffolding & Docker Infrastructure](#phase-1-project-scaffolding--docker-infrastructure)
- [Phase 2: Database Schema & Models](#phase-2-database-schema--models)
- [Phase 3: Project CRUD API](#phase-3-project-crud-api)
- [Phase 4: Audio Upload & Storage](#phase-4-audio-upload--storage)
- [Phase 5: Audio Trimming (FFmpeg)](#phase-5-audio-trimming-ffmpeg)
- [Phase 6: Transcription Pipeline (WhisperX + Celery)](#phase-6-transcription-pipeline-whisperx--celery)
- [Phase 7: Lyrics Review & Editing](#phase-7-lyrics-review--editing)
- [Phase 8: AI Vibe Analysis & Keywords (Claude API)](#phase-8-ai-vibe-analysis--keywords-claude-api)
- [Phase 9: Visual Source - Stock Video (Pexels API)](#phase-9-visual-source---stock-video-pexels-api)
- [Phase 10: Text Style System (6 FFmpeg Styles)](#phase-10-text-style-system-6-ffmpeg-styles)
- [Phase 11: Render Pipeline (FFmpeg Video Compositing)](#phase-11-render-pipeline-ffmpeg-video-compositing)
- [Phase 12: Batch Generation & Progress Tracking](#phase-12-batch-generation--progress-tracking)
- [Phase 13: Download, Polish & Error Handling](#phase-13-download-polish--error-handling)
- [Phase 14: Frontend UI - Full Wizard Flow](#phase-14-frontend-ui---full-wizard-flow)
- [Final Steps: Push & Deploy](#final-steps-push--deploy)
- [Architecture Reference](#architecture-reference)

---

## Prerequisites & Initial Setup

### What You Need Installed

| Tool | Version | Check Command |
|------|---------|---------------|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | v2.0+ | `docker compose version` |
| Git | any | `git --version` |
| Node.js | 20+ (for local dev only) | `node --version` |
| Python | 3.11+ (for local dev only) | `python3 --version` |

### Optional API Keys (runs in mock mode without them)

| Service | What It Does | Where to Get |
|---------|-------------|--------------|
| Pexels API Key | Stock video search | https://www.pexels.com/api/ (free) |
| Anthropic API Key | AI vibe suggestions & keyword extraction | https://console.anthropic.com/ |
| Cloudflare R2 | Cloud file storage | https://dash.cloudflare.com/ |

### Clone & Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/HarshRathore-sudo/Reels-Generator.git
cd Reels-Generator

# 2. Create environment file from template
cp backend/.env.example backend/.env

# 3. (Optional) Add your API keys to backend/.env
#    Without keys, everything runs in mock mode - perfectly fine for development

# 4. Build and start all services
docker compose up -d --build

# 5. Run database migrations
docker compose exec backend alembic upgrade head

# 6. Verify everything is running
docker compose ps
curl http://localhost:61278/api/health
```

**Expected output from health check:**
```json
{"status": "ok", "service": "doles-reels-generator", "r2_configured": false}
```

### Service Architecture After Setup

```
Port 61278 (your browser)
    |
    v
+--------+     +----------+     +---------+
| Nginx  | --> | Frontend | --> | Browser |
|  :80   |     | Vite     |     |  React  |
+--------+     | :5173    |     +---------+
    |          +----------+
    |
    +--> +----------+     +----------+     +---------+
         | Backend  | --> | Postgres | --> | pgdata  |
         | FastAPI  |     |  :5432   |     | volume  |
         | :8000    |     +----------+     +---------+
         +----------+
              |
              +--> +--------+     +----------+
                   | Redis  | <-- | Celery   |
                   | :6379  |     | Worker   |
                   +--------+     +----------+
```

### How to Test the Initial Setup

1. Open browser: `http://localhost:61278`
2. You should see the Doles Reels Generator landing page
3. API health: `curl http://localhost:61278/api/health`
4. Check all 6 containers: `docker compose ps` (all should show "Up")

---

## Phase 1: Project Scaffolding & Docker Infrastructure

### What This Phase Is

Set up the entire project skeleton - folder structure, Docker configuration, Nginx reverse proxy, and both frontend/backend boilerplates. This is the foundation everything else builds on.

### What You Build

1. **Docker Compose** with 6 services (nginx, frontend, backend, postgres, redis, celery_worker)
2. **Nginx** reverse proxy routing `/` to frontend and `/api` to backend
3. **Frontend** boilerplate (React + Vite + TypeScript + Tailwind CSS v4)
4. **Backend** boilerplate (FastAPI + Uvicorn)
5. **Dockerfiles** for frontend and backend

### Files Created

```
project-root/
  docker-compose.yml          # 6-service orchestration
  nginx.conf                  # Reverse proxy config
  .env                        # Root environment variables
  .gitignore                  # Git ignore patterns

  frontend/
    Dockerfile                # Node 20 base, npm install, vite dev server
    package.json              # React 18, Vite, TypeScript, Tailwind v4
    vite.config.ts            # Vite config with Tailwind plugin
    tsconfig.json             # TypeScript strict config
    index.html                # Entry HTML
    src/
      main.tsx                # React entry point
      App.tsx                 # App root (placeholder)
      index.css               # Tailwind directives + global styles

  backend/
    Dockerfile                # Python 3.11 base, pip install, uvicorn
    requirements.txt          # FastAPI, SQLAlchemy, Celery, etc.
    .env.example              # Environment template
    app/
      __init__.py
      main.py                 # FastAPI app with CORS + health endpoint
```

### Key Configuration Details

**docker-compose.yml** - The orchestration file:
```yaml
services:
  nginx:           # Port 61278:80, routes to frontend + backend
  frontend:        # Vite dev server on :5173 (internal only)
  backend:         # Uvicorn on :8000 (internal only)
  postgres:        # PostgreSQL 16 with healthcheck
  redis:           # Redis 7 with healthcheck
  celery_worker:   # Same image as backend, runs celery command
```

**nginx.conf** - Gateway routing:
```nginx
location /     -> proxy_pass http://frontend:5173   (+ WebSocket for HMR)
location /api  -> proxy_pass http://backend:8000    (+ 300s timeout for renders)
```

**Key decisions:**
- Frontend and backend NEVER expose ports externally - only nginx does
- Volume mounts for hot reload (edit code, see changes immediately)
- Postgres and Redis have healthchecks - backend waits for them

### How to Test Phase 1

```bash
# Build everything
docker compose up -d --build

# Check all 6 services are running
docker compose ps
# Expected: 6 services, all "Up"

# Test nginx routing to frontend
curl -s http://localhost:61278 | head -5
# Expected: HTML content (React app)

# Test nginx routing to backend
curl http://localhost:61278/api/health
# Expected: {"status": "ok", ...}

# Test hot reload - edit frontend/src/App.tsx, save, refresh browser
# Changes should appear instantly without rebuild
```

---

## Phase 2: Database Schema & Models

### What This Phase Is

Design and create the PostgreSQL database schema with 5 tables that model the entire reel generation workflow. Set up SQLAlchemy ORM models and Alembic for database migrations.

### What You Build

1. **5 ORM models**: Project, AudioFile, Lyrics, ClipPool, GeneratedReel
2. **Alembic migration system** for database versioning
3. **Async database engine** for FastAPI (asyncpg)
4. **Sync database engine** for Celery workers (psycopg2)
5. **Pydantic Settings** for environment configuration

### Files Created

```
backend/
  alembic.ini                              # Alembic config
  alembic/
    env.py                                 # Migration environment
    script.py.mako                         # Migration template
    versions/
      a67826005c70_initial_schema.py       # Initial migration
  app/
    core/
      __init__.py
      config.py                            # Pydantic Settings (all env vars)
      database.py                          # Async SQLAlchemy engine + session
      sync_database.py                     # Sync engine for Celery workers
    models/
      __init__.py
      db_models.py                         # All 5 ORM models
```

### Database Schema (Entity Relationships)

```
projects (1) ----< (N) audio_files
    |
    +------- (1) ----< (N) lyrics
    |
    +------- (1) ----< (N) clip_pool
    |                          |
    +------- (1) ----< (N) generated_reels >---- (1) clip_pool
```

### Table Details

**projects**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| name | VARCHAR(255) | Project name |
| status | ENUM | draft, transcribed, vibe_set, generating, complete |
| language | ENUM | hi_dev (default), hi_rom, en |
| vibe_description | TEXT | Free-text vibe |
| vibe_keywords | JSON | Array of keywords |
| visual_mode | ENUM | stock or custom |
| custom_video_url | VARCHAR(1024) | URL if mode=custom |
| created_at / updated_at | DATETIME | Timestamps |

**audio_files** - Stores uploaded and trimmed audio metadata
**lyrics** - Word-level timing data as JSON array
**clip_pool** - Pexels video clips with relevance scores
**generated_reels** - Rendered reel status and output URLs

**Important**: All child tables use `ondelete="CASCADE"` - deleting a project cleans up everything.

### How to Test Phase 2

```bash
# Run migrations
docker compose exec backend alembic upgrade head

# Verify tables were created
docker compose exec postgres psql -U user -d doles_reels -c "\dt"
# Expected: 6 tables (5 + alembic_version)

# Check migration status
docker compose exec backend alembic current
# Expected: Shows current revision as head

# Verify table structure
docker compose exec postgres psql -U user -d doles_reels -c "\d projects"
# Expected: All columns with correct types

# Test table relationships (cascade)
docker compose exec postgres psql -U user -d doles_reels -c "
  SELECT conname, conrelid::regclass, confrelid::regclass
  FROM pg_constraint WHERE contype = 'f';
"
# Expected: Foreign keys pointing to projects table
```

---

## Phase 3: Project CRUD API

### What This Phase Is

Build the REST API endpoints for creating, listing, viewing, and deleting projects. This is the first "real" API functionality and establishes the pattern for all subsequent endpoints.

### What You Build

1. **4 CRUD endpoints**: Create, List, Get, Delete projects
2. **Pydantic schemas** for request validation and response serialization
3. **Router registration** pattern for organizing API routes
4. **Request logging middleware** for debugging
5. **Global exception handlers** for consistent error responses

### Files Created/Modified

```
backend/app/
  main.py                    # Updated: CORS, logging middleware, error handlers
  api/
    __init__.py              # Router registration
    projects.py              # CRUD route handlers
  schemas/
    __init__.py
    project.py               # ProjectCreate, ProjectResponse schemas
```

### API Endpoints

| Method | Endpoint | What It Does |
|--------|----------|-------------|
| `POST` | `/api/projects` | Create a new project (name required, 1-100 chars) |
| `GET` | `/api/projects` | List all projects (newest first) |
| `GET` | `/api/projects/{id}` | Get single project by UUID |
| `DELETE` | `/api/projects/{id}` | Delete project + all associated data |

### Key Patterns Established

**Request validation with Pydantic v2:**
```python
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    def strip_name(cls, v):
        return v.strip()
```

**Async database access:**
```python
@router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=data.name)
    db.add(project)
    await db.commit()
    return project
```

### How to Test Phase 3

```bash
# Create a project
curl -X POST http://localhost:61278/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Tum Hi Ho - Reel"}'
# Expected: 201 with project JSON (id, name, status="draft")

# List projects
curl http://localhost:61278/api/projects
# Expected: Array with the project you just created

# Get single project (replace UUID)
curl http://localhost:61278/api/projects/{project_id}
# Expected: Full project object

# Test validation - empty name
curl -X POST http://localhost:61278/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
# Expected: 422 validation error

# Delete project
curl -X DELETE http://localhost:61278/api/projects/{project_id}
# Expected: 204 No Content

# Verify deletion
curl http://localhost:61278/api/projects/{project_id}
# Expected: 404 Not Found
```

---

## Phase 4: Audio Upload & Storage

### What This Phase Is

Build the audio file upload system using Cloudflare R2 (S3-compatible storage) with presigned URLs for direct browser-to-storage uploads. Includes a complete mock mode for development without cloud credentials.

### What You Build

1. **R2 Storage Service** with presigned URL generation + mock mode
2. **Upload flow**: Get URL -> Browser uploads -> Confirm upload
3. **Audio metadata tracking** in the database
4. **Audio download URL generation**
5. **Frontend AudioUploader component** with drag & drop

### Files Created

```
backend/app/
  services/
    __init__.py
    r2_service.py            # R2 storage client (presigned URLs, upload/download, mock)
  api/
    audio.py                 # Upload URL, confirm, get audio, download URL endpoints
  schemas/
    audio.py                 # Upload, confirm, download schemas

frontend/src/
  api/
    apiClient.ts             # Axios instance with retry logic
    audioApi.ts              # Upload URL, confirm, trim, transcribe API calls
  components/audio/
    AudioUploader.tsx         # File input + upload flow component
    WaveformPreview.tsx       # Read-only waveform display
  hooks/
    useAudioUpload.ts        # Upload logic hook
  types/
    index.ts                 # TypeScript interfaces (Project, AudioFile, etc.)
```

### Upload Flow

```
Browser                    Backend API                 R2 Storage
  |                           |                           |
  |-- POST /upload-url ------>|                           |
  |   {filename, content_type}|                           |
  |<-- {upload_url, file_key}-|                           |
  |                           |                           |
  |-- PUT file bytes ---------------------------------->|
  |<-- 200 OK ------------------------------------------|
  |                           |                           |
  |-- POST /confirm --------->|-- verify file exists -->|
  |   {file_key, duration}    |<-- exists --------------|
  |<-- AudioFile object ------|                           |
```

### Mock Mode Behavior

When `R2_ACCOUNT_ID` is not set in `.env`:
- `upload_url` returns a fake placeholder URL
- `confirm` always succeeds (skips existence check)
- `download_url` returns a mock URL
- Everything works - you just don't actually store files in the cloud

### How to Test Phase 4

```bash
# Step 1: Get upload URL
curl -X POST http://localhost:61278/api/projects/{id}/audio/upload-url \
  -H "Content-Type: application/json" \
  -d '{"filename": "song.mp3", "content_type": "audio/mpeg"}'
# Expected: {"upload_url": "...", "file_key": "projects/{id}/audio/original_xxx.mp3"}

# Step 2: Confirm upload (in mock mode, skip actual upload)
curl -X POST http://localhost:61278/api/projects/{id}/audio/confirm \
  -H "Content-Type: application/json" \
  -d '{"file_key": "projects/{id}/audio/original_xxx.mp3", "duration_seconds": 180.5}'
# Expected: 201 with AudioFile object

# Step 3: Get audio metadata
curl http://localhost:61278/api/projects/{id}/audio
# Expected: AudioFile with original_url, duration, etc.

# Step 4: Get download URL
curl http://localhost:61278/api/projects/{id}/audio/download-url
# Expected: {"download_url": "...", "file_key": "..."}

# Frontend test: Open browser, go to a project flow, try uploading an audio file
# The waveform preview should appear after upload
```

---

## Phase 5: Audio Trimming (FFmpeg)

### What This Phase Is

Add FFmpeg-based audio trimming so users can select a 30-second segment from their uploaded audio. Includes an interactive waveform with draggable region selection.

### What You Build

1. **FFmpeg Service** for audio extraction/trimming
2. **Trim API endpoint** that extracts a segment and re-uploads
3. **Frontend AudioTrimmer** with WaveSurfer.js v7 + Regions plugin
4. **Trim validation** (max 30.5 seconds, within audio bounds)

### Files Created/Modified

```
backend/app/
  services/
    ffmpeg_service.py        # FFmpeg wrapper for trim + render operations
  api/
    audio.py                 # Added: POST /audio/trim endpoint

frontend/src/
  components/audio/
    AudioTrimmer.tsx          # WaveSurfer + Regions for interactive trim
```

### Trim Flow

```
User drags region on waveform (0:15 to 0:45)
    |
    v
POST /api/projects/{id}/audio/trim
  {"start_sec": 15.0, "end_sec": 45.0}
    |
    v
Backend:
  1. Download original audio from R2
  2. FFmpeg: extract segment (ffmpeg -ss 15 -t 30 -i input.mp3 output.mp3)
  3. Upload trimmed audio to R2
  4. Update AudioFile in DB (trimmed_url, new duration)
    |
    v
Response: Updated AudioFile with trimmed_url set
```

### FFmpeg Trim Command

```bash
ffmpeg -i original.mp3 -ss 15.0 -t 30.0 -c:a libmp3lame -q:a 2 -y trimmed.mp3
```

### Validation Rules

- `end_sec - start_sec` must be <= 30.5 seconds
- `start_sec` must be >= 0
- `end_sec` must not exceed audio duration + 0.5s tolerance
- Both values must be valid numbers

### How to Test Phase 5

```bash
# Trim audio (must have audio uploaded first)
curl -X POST http://localhost:61278/api/projects/{id}/audio/trim \
  -H "Content-Type: application/json" \
  -d '{"start_sec": 10.0, "end_sec": 40.0}'
# Expected: AudioFile with trimmed_url set, duration_seconds = 30.0

# Test validation - segment too long
curl -X POST http://localhost:61278/api/projects/{id}/audio/trim \
  -H "Content-Type: application/json" \
  -d '{"start_sec": 0.0, "end_sec": 45.0}'
# Expected: 400 error - segment exceeds 30.5 seconds

# Test validation - negative start
curl -X POST http://localhost:61278/api/projects/{id}/audio/trim \
  -H "Content-Type: application/json" \
  -d '{"start_sec": -5.0, "end_sec": 25.0}'
# Expected: 400 or 422 validation error

# Frontend test: Open project flow Step 2
# - Waveform should load with audio
# - Drag region handles to select 30-sec segment
# - Click "Trim" button
# - Should advance to Step 3
```

---

## Phase 6: Transcription Pipeline (WhisperX + Celery)

### What This Phase Is

Build an asynchronous transcription system using Celery background workers. The trimmed audio is transcribed with WhisperX to get word-level timing data. This is the first async (background task) flow.

### What You Build

1. **Celery configuration** with Redis broker
2. **Transcription worker** (Celery task)
3. **WhisperX service** for speech-to-text with word timestamps
4. **Transcription service** orchestrating the flow
5. **Jobs API** for polling task status
6. **Librosa service** for beat detection (bonus: tempo + beat timestamps)
7. **Frontend TranscriptionProgress** with polling UI

### Files Created

```
backend/app/
  workers/
    __init__.py
    celery_app.py                  # Celery config (broker, serializer, etc.)
    transcription_worker.py        # Async transcription task
  services/
    transcription_service.py       # Transcription orchestration
    whisperx_service.py            # WhisperX model wrapper + mock
    librosa_service.py             # Beat detection service
  api/
    audio.py                       # Added: POST /audio/transcribe, POST /audio/beats
    jobs.py                        # GET /jobs/{job_id} - task status polling
  schemas/
    audio.py                       # Added: transcription + beat schemas

frontend/src/
  components/audio/
    TranscriptionProgress.tsx      # Progress bar + polling
```

### Async Task Flow

```
Browser                    Backend API               Celery Worker
  |                           |                          |
  |-- POST /transcribe ------>|                          |
  |   {"language": "hi_dev"}  |-- dispatch task -------->|
  |<-- {"job_id": "xxx"} ----|                          |
  |                           |                          |
  |   (poll every 2 seconds)  |                          |
  |-- GET /jobs/xxx --------->|                          |
  |<-- {progress: 30%} ------|                          |
  |                           |                          |-- download audio
  |-- GET /jobs/xxx --------->|                          |-- run WhisperX
  |<-- {progress: 70%} ------|                          |-- parse words
  |                           |                          |-- save to DB
  |-- GET /jobs/xxx --------->|                          |
  |<-- {status: "complete"} --|                          |
```

### Supported Languages

| Code | Language | Font Used |
|------|----------|-----------|
| `hi_dev` | Hindi (Devanagari script) | NotoSansDevanagari-Bold.ttf |
| `hi_rom` | Hindi (Romanized/Latin) | Inter-Bold.ttf |
| `en` | English | Inter-Bold.ttf |

### Word Timing Data Format

```json
{
  "words": [
    {"word": "Tum", "start": 0.5, "end": 0.9, "line_index": 0},
    {"word": "Hi", "start": 0.95, "end": 1.3, "line_index": 0},
    {"word": "Ho", "start": 1.35, "end": 1.8, "line_index": 0},
    {"word": "Tum", "start": 2.0, "end": 2.4, "line_index": 1},
    {"word": "Hi", "start": 2.5, "end": 2.8, "line_index": 1},
    {"word": "Ho", "start": 2.85, "end": 3.3, "line_index": 1}
  ]
}
```

### How to Test Phase 6

```bash
# Start transcription (project must have trimmed audio)
curl -X POST http://localhost:61278/api/projects/{id}/audio/transcribe \
  -H "Content-Type: application/json" \
  -d '{"language": "hi_dev"}'
# Expected: {"job_id": "celery-task-uuid"}

# Poll job status
curl http://localhost:61278/api/jobs/{job_id}
# Expected: {"job_id": "...", "status": "running", "progress": 50, ...}
# Keep polling until status is "complete"

# After completion, check project status changed
curl http://localhost:61278/api/projects/{id}
# Expected: status should now be "transcribed"

# Check lyrics were saved
curl http://localhost:61278/api/projects/{id}/lyrics
# Expected: {"words": [...], "raw_transcription": "..."}

# Test beat detection
curl -X POST http://localhost:61278/api/projects/{id}/audio/beats
# Expected: {"beat_timestamps": [...], "tempo_bpm": 128.5, "total_beats": 58}

# Check Celery worker logs
docker compose logs celery_worker --tail=20
# Expected: Task received, processing stages, task succeeded

# Frontend test: Step 3 should show progress bar filling up
# On completion, auto-advances to Step 4 (lyrics review)
```

---

## Phase 7: Lyrics Review & Editing

### What This Phase Is

Build an interactive lyrics review dashboard where users can view, edit, and fine-tune the auto-transcribed words. Users can change word text, adjust start/end timing, reassign line breaks, and preview how the text will look.

### What You Build

1. **Lyrics API endpoints** (Get + Update)
2. **LyricsReviewDashboard** - main container with 3 panels
3. **LyricsListPanel** - editable word list
4. **WordTimeline** - visual timeline with draggable word blocks
5. **BlackPreview** - live preview simulating reel appearance
6. **TextStylePicker** - preview all 6 text styles

### Files Created

```
backend/app/
  api/
    lyrics.py                          # GET/PUT lyrics endpoints
  schemas/
    lyrics.py                          # LyricsResponse, LyricsUpdateRequest

frontend/src/
  api/
    lyricsApi.ts                       # Get/update lyrics API calls
  components/lyrics/
    LyricsReviewDashboard.tsx          # Main container (3-panel layout)
    LyricsListPanel.tsx                # Editable word list
    WordTimeline.tsx                   # Visual timeline
    BlackPreview.tsx                   # Live text preview on black bg
    TextStylePicker.tsx                # Style selection grid
  hooks/
    useWordTimeline.ts                 # Timeline drag/resize interactions
```

### Dashboard Layout

```
+----------------------------------+
|      Lyrics Review Dashboard     |
+----------+----------+------------+
| List     | Timeline | Preview    |
| Panel    |          |            |
|          | [word]---[word]---    | Black bg  |
| Word 1   |  |  |     |  |      | with      |
| Word 2   |  Drag to adjust     | animated  |
| Word 3   |  timing             | text      |
| ...      |                     |            |
+----------+----------+------------+
|          Text Style Picker       |
+----------------------------------+
```

### Edit Capabilities

| Action | How It Works |
|--------|-------------|
| Edit word text | Click word in list, type new text |
| Adjust timing | Drag word block edges on timeline |
| Change line breaks | Update `line_index` to group words into lines |
| Preview | Black preview panel shows real-time text rendering |
| Save | PUT /lyrics sends updated words array to backend |

### How to Test Phase 7

```bash
# Get lyrics (project must be transcribed)
curl http://localhost:61278/api/projects/{id}/lyrics
# Expected: {"words": [...], "raw_transcription": "..."}

# Update lyrics - change word text and timing
curl -X PUT http://localhost:61278/api/projects/{id}/lyrics \
  -H "Content-Type: application/json" \
  -d '{
    "words": [
      {"word": "Hello", "start": 0.5, "end": 1.0, "line_index": 0},
      {"word": "World", "start": 1.1, "end": 1.6, "line_index": 0}
    ]
  }'
# Expected: Updated lyrics with new words

# Test validation - end before start
curl -X PUT http://localhost:61278/api/projects/{id}/lyrics \
  -H "Content-Type: application/json" \
  -d '{
    "words": [
      {"word": "Bad", "start": 2.0, "end": 1.0, "line_index": 0}
    ]
  }'
# Expected: 400 error - end must be greater than start

# Frontend test: Step 4 - Lyrics Review Dashboard
# - Words should appear in the list panel
# - Click a word to edit its text
# - Drag word blocks on the timeline to adjust timing
# - Preview panel should show text animation on black background
# - Click "Save & Continue" to proceed
```

---

## Phase 8: AI Vibe Analysis & Keywords (Claude API)

### What This Phase Is

Integrate Anthropic's Claude AI for two intelligent features: (1) suggesting a vibe/mood description based on the song's lyrics and tempo, and (2) extracting visual search keywords from the vibe description. These keywords drive the stock video search in Phase 9.

### What You Build

1. **Claude AI Service** with 3 methods (suggest vibe, extract keywords, rank clips)
2. **Prompt templates** for each AI task
3. **Vibe API endpoints** (set vibe, suggest vibe, get/update keywords)
4. **Frontend VibeInput** with AI suggest button
5. **Frontend KeywordEditor** for manual keyword editing

### Files Created

```
backend/app/
  services/
    claude_service.py                  # Claude API integration + mock
  prompts/
    vibe_suggestion.txt                # Prompt: suggest vibe from lyrics+tempo
    keyword_extraction.txt             # Prompt: extract visual keywords
    clip_ranking.txt                   # Prompt: rank clips by relevance
  api/
    vibe.py                            # Set vibe, suggest, get/update keywords
  schemas/
    vibe.py                            # VibeRequest, KeywordsUpdateRequest

frontend/src/
  api/
    vibeApi.ts                         # Vibe API calls
  components/vibe/
    VibeInput.tsx                      # Vibe textarea + AI suggest
    KeywordEditor.tsx                  # Keyword tag editor
```

### AI Flow

```
Step 1: AI Suggest Vibe (optional)
  Lyrics text + Tempo BPM + Language
    --> Claude claude-sonnet-4-20250514
    --> "Soulful romantic Bollywood ballad with..."

Step 2: User sets vibe (edits or writes their own)
  "Romantic monsoon night in Mumbai, warm streetlights..."
    --> POST /api/projects/{id}/vibe
    --> Claude extracts keywords automatically
    --> ["monsoon", "mumbai streets", "warm lights", "wet roads", "romantic night"]

Step 3: User can manually edit keywords
  PUT /api/projects/{id}/keywords
  Min 3, max 10 keywords
```

### Mock Mode

When `ANTHROPIC_API_KEY` is not set:
- Vibe suggestion returns a preset romantic Bollywood description
- Keyword extraction returns generic sample keywords
- Everything still works end-to-end, just with static responses

### How to Test Phase 8

```bash
# AI suggest a vibe (project must be transcribed with audio)
curl -X POST http://localhost:61278/api/projects/{id}/vibe/suggest
# Expected: {"suggestion": "Soulful and melancholic Bollywood romance..."}

# Set vibe description (auto-extracts keywords)
curl -X POST http://localhost:61278/api/projects/{id}/vibe \
  -H "Content-Type: application/json" \
  -d '{"vibe_description": "Romantic monsoon night in Mumbai, warm streetlights reflecting on wet roads"}'
# Expected: {"vibe_description": "...", "keywords": [...], "status": "vibe_set"}

# Check project status changed
curl http://localhost:61278/api/projects/{id}
# Expected: status = "vibe_set"

# Get keywords
curl http://localhost:61278/api/projects/{id}/keywords
# Expected: {"keywords": ["monsoon", "mumbai streets", ...]}

# Update keywords manually
curl -X PUT http://localhost:61278/api/projects/{id}/keywords \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["rain", "city lights", "romance", "night sky", "love"]}'
# Expected: Updated keywords

# Test min keyword validation
curl -X PUT http://localhost:61278/api/projects/{id}/keywords \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["one", "two"]}'
# Expected: 400 error - minimum 3 keywords

# Frontend test: Step 5
# - Click "AI Suggest" to get vibe suggestion
# - Edit the text if desired
# - Click "Set Vibe" to save and extract keywords
# - Keywords appear as editable chips/tags
# - Can add/remove keywords (3-10 range)
```

---

## Phase 9: Visual Source - Stock Video (Pexels API)

### What This Phase Is

Integrate the Pexels Video API to search for aesthetic stock video clips based on the vibe keywords. Clips are searched, deduplicated, and ranked by relevance to the vibe using Claude AI. A "clip pool" is built as a Celery background task.

### What You Build

1. **Pexels Video Service** for searching stock videos + mock
2. **Clip pool builder** Celery worker task
3. **Visual mode selector** (stock vs custom video)
4. **Clip pool gallery** showing ranked clips
5. **Custom video URL input** (alternative to stock)

### Files Created

```
backend/app/
  services/
    pexels_service.py                  # Pexels API client + mock
    ytdlp_service.py                   # Video download helper
  workers/
    pool_builder_worker.py             # Celery task: search + rank clips
  api/
    visual.py                          # Visual mode, custom video, build pool, get clips
  schemas/
    visual.py                          # VisualMode, ClipPool schemas

frontend/src/
  api/
    visualApi.ts                       # Visual API calls
  components/visual/
    VisualModeSelector.tsx             # Stock vs Custom toggle
    ClipPoolGallery.tsx                # Grid of video clips with scores
    CustomVideoInput.tsx               # URL input for custom video
```

### Clip Pool Build Flow

```
POST /api/projects/{id}/clips/build-pool
    |
    v
Celery Worker:
  1. Load project keywords from DB
  2. Search Pexels for each keyword (5 keywords x N results)
  3. Deduplicate clips by Pexels video ID
  4. Send clips + vibe to Claude for relevance ranking (0.0-1.0)
  5. Save top clips to clip_pool table
  6. Report progress via job status
    |
    v
Frontend polls GET /api/jobs/{job_id} for progress
Then GET /api/projects/{id}/clips to display pool
```

### Clip Pool Entry

```json
{
  "id": "uuid",
  "pexels_clip_id": "12345",
  "clip_url": "https://videos.pexels.com/...",
  "duration_seconds": 15.0,
  "width": 1920,
  "height": 1080,
  "relevance_score": 0.92,
  "used": false
}
```

### How to Test Phase 9

```bash
# Set visual mode to "stock"
curl -X POST http://localhost:61278/api/projects/{id}/visual-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "stock"}'
# Expected: {"visual_mode": "stock", ...}

# Build clip pool (project must have keywords set)
curl -X POST http://localhost:61278/api/projects/{id}/clips/build-pool
# Expected: {"job_id": "...", "message": "Clip pool build started..."}

# Poll job status
curl http://localhost:61278/api/jobs/{job_id}
# Poll until status = "complete"

# Get clip pool
curl http://localhost:61278/api/projects/{id}/clips
# Expected: {"clips": [...], "total": N, "visual_mode": "stock"}
# Clips should be sorted by relevance_score (highest first)

# Test custom video mode
curl -X POST http://localhost:61278/api/projects/{id}/custom-video \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/my-video.mp4"}'
# Expected: visual_mode = "custom", custom_video_url = the URL

# Frontend test: Step 6
# - Toggle between "Stock Video" and "Custom Video"
# - In Stock mode, click "Build Pool" to search Pexels
# - Progress bar while building
# - Gallery displays clips ranked by relevance
# - In Custom mode, paste a video URL
```

---

## Phase 10: Text Style System (6 FFmpeg Styles)

### What This Phase Is

Create 6 distinct text overlay styles that generate FFmpeg `drawtext` filter strings. Each style produces unique animations (fade, karaoke, pop, typewriter, stacked, cinematic) for the lyrics overlay.

### What You Build

1. **Base text style class** with font resolution and text escaping
2. **6 concrete style implementations** (each generates FFmpeg filter strings)
3. **Text render service** that orchestrates style selection
4. **Text styles API** for listing styles and previewing filters
5. **Font files** for Hindi (Devanagari) and English/Romanized

### Files Created

```
backend/
  fonts/
    Inter-Bold.ttf                     # Latin script (English, Hindi romanized)
    Inter-Regular.ttf
    NotoSansDevanagari-Bold.ttf        # Devanagari script (Hindi)
    NotoSansDevanagari-Regular.ttf
  app/
    text_styles/
      __init__.py                      # Style registry (STYLES dict)
      base.py                          # BaseTextStyle abstract class
      style_1_minimal_fade.py          # Clean fade in/out per word
      style_2_karaoke.py               # Sequential word highlighting
      style_3_word_pop.py              # Scale-up pop animation
      style_4_typewriter.py            # One-by-one typing effect
      style_5_stacked.py               # Lines stacking bottom to top
      style_6_cinematic.py             # Movie-style bottom subtitles
    services/
      text_render_service.py           # Style orchestration + font mapping
    api/
      text_styles.py                   # List styles, get style, preview filter
```

### The 6 Text Styles

| # | Style | Animation | Position |
|---|-------|-----------|----------|
| 1 | **Minimal Fade** | Each word fades in/out smoothly | Center screen |
| 2 | **Karaoke Highlight** | Words highlight sequentially as sung | Center, highlighted word changes color |
| 3 | **Word Pop** | Words pop in with scale animation | Center with bounce |
| 4 | **Typewriter** | Words appear one-by-one as if typed | Left-aligned, cursor effect |
| 5 | **Stacked Lines** | Full lines stack from bottom to top | Bottom third |
| 6 | **Cinematic Subtitle** | Movie-style subtitles | Bottom of screen |

### FFmpeg drawtext Filter Example (Style 1 - Minimal Fade)

```
drawtext=text='Hello':
  fontfile=/app/fonts/Inter-Bold.ttf:
  fontsize=72:
  fontcolor=white:
  x=(w-text_w)/2:
  y=(h-text_h)/2:
  enable='between(t,0.5,1.0)':
  alpha='if(lt(t,0.6),10*(t-0.5),if(gt(t,0.9),10*(1.0-t),1))'
```

### Font Resolution

```python
def get_font_path(language: str) -> str:
    if language == "hi_dev":
        return "/app/fonts/NotoSansDevanagari-Bold.ttf"
    else:  # "en" or "hi_rom"
        return "/app/fonts/Inter-Bold.ttf"
```

### How to Test Phase 10

```bash
# List all text styles
curl http://localhost:61278/api/text-styles
# Expected: {"styles": [6 style objects], "total": 6}

# Get specific style
curl http://localhost:61278/api/text-styles/1
# Expected: {"id": 1, "name": "Minimal Fade", ...}

# Preview a filter string
curl -X POST http://localhost:61278/api/text-styles/preview \
  -H "Content-Type: application/json" \
  -d '{
    "style_number": 1,
    "words": [
      {"word": "Hello", "start": 0.5, "end": 1.0, "line_index": 0},
      {"word": "World", "start": 1.1, "end": 1.6, "line_index": 0}
    ],
    "language": "en",
    "duration": 30.0
  }'
# Expected: {"style_number": 1, "filter_string": "drawtext=...", "filter_count": 2, ...}

# Test all 6 styles
for i in 1 2 3 4 5 6; do
  echo "Style $i:"
  curl -s -X POST http://localhost:61278/api/text-styles/preview \
    -H "Content-Type: application/json" \
    -d "{\"style_number\": $i, \"words\": [{\"word\": \"Test\", \"start\": 0.5, \"end\": 1.0, \"line_index\": 0}], \"language\": \"en\", \"duration\": 30.0}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['style_name'])"
done
# Expected: Minimal Fade, Karaoke Highlight, Word Pop, Typewriter, Stacked Lines, Cinematic Subtitle

# Check fonts exist in container
docker compose exec backend ls -la /app/fonts/
# Expected: 4 font files (Inter-Bold, Inter-Regular, NotoSansDevanagari-Bold, NotoSansDevanagari-Regular)
```

---

## Phase 11: Render Pipeline (FFmpeg Video Compositing)

### What This Phase Is

Build the core video rendering pipeline. This is the heart of the system - a 7-stage Celery worker that takes a video clip, audio file, and text overlay filters, then composites them into a 1080x1920 vertical Instagram reel using FFmpeg.

### What You Build

1. **Render worker** (7-stage Celery task with progress reporting)
2. **FFmpeg render command builder** (scale, crop, fps, drawtext, encode)
3. **Single reel render endpoint** (for testing one style)
4. **Render status tracking** in database

### Files Created/Modified

```
backend/app/
  workers/
    render_worker.py                   # 7-stage render pipeline task
  services/
    ffmpeg_service.py                  # Updated: full render_reel_sync method
  api/
    generation.py                      # POST /render-single endpoint
  schemas/
    generation.py                      # Render request/response schemas
```

### 7-Stage Render Pipeline

```
Stage 1 (5%)   Load project data (lyrics, audio path, clip) from database
    |
Stage 2 (15%)  Download video clip (from Pexels URL or R2)
    |
Stage 3 (25%)  Download trimmed audio (from R2)
    |
Stage 4 (35%)  Generate text overlay filter string using selected style
    |
Stage 5 (70%)  Run FFmpeg render command:
    |           - Scale video to 1080x1920 (vertical)
    |           - Crop to fill frame (no letterbox)
    |           - Set FPS to 30
    |           - Trim to 30 seconds
    |           - Apply drawtext filters (animated text)
    |           - Encode H.264 video + AAC audio
    |
Stage 6 (90%)  Upload rendered MP4 to R2 storage
    |
Stage 7 (100%) Update database: render_status = "complete", set output_url
```

### FFmpeg Render Command

```bash
ffmpeg \
  -i video_clip.mp4 \
  -i trimmed_audio.mp3 \
  -filter_complex "
    [0:v]
    scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    fps=30,
    trim=duration=30,
    setpts=PTS-STARTPTS,
    drawtext=text='Word1':fontfile=...:enable='between(t,0.5,1.0)':...,
    drawtext=text='Word2':fontfile=...:enable='between(t,1.1,1.6)':...
    [v]
  " \
  -map "[v]" -map 1:a \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -t 30 -y output.mp4
```

### Mock Render Mode

When actual video clips aren't available, uses FFmpeg color source:
```bash
ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=5 ...
```
Generates a 5-second black test video (fast, no external dependencies).

### How to Test Phase 11

```bash
# Render a single test reel (project must have audio + lyrics)
curl -X POST http://localhost:61278/api/projects/{id}/render-single \
  -H "Content-Type: application/json" \
  -d '{"text_style": 1}'
# Expected: {"reel_id": "...", "job_id": "...", "text_style": 1, "render_status": "queued"}

# Poll render progress
curl http://localhost:61278/api/jobs/{job_id}
# Expected: Progress through stages: 5% -> 15% -> 25% -> 35% -> 70% -> 90% -> 100%

# Check reel status after completion
curl http://localhost:61278/api/projects/{id}/reels
# Expected: {"reels": [{"text_style": 1, "render_status": "complete", ...}]}

# Check celery worker logs for render details
docker compose logs celery_worker --tail=30
# Expected: Stage 1/7 through Stage 7/7 messages

# Test all 6 styles individually
for style in 1 2 3 4 5 6; do
  curl -X POST http://localhost:61278/api/projects/{id}/render-single \
    -H "Content-Type: application/json" \
    -d "{\"text_style\": $style}"
  echo " -> Style $style queued"
done
```

---

## Phase 12: Batch Generation & Progress Tracking

### What This Phase Is

Build the batch generation system that creates all 6 reels at once (one per text style) and provides real-time progress tracking. This is what the user triggers with the "Generate Reels" button.

### What You Build

1. **Batch generation endpoint** (queues 6 render tasks)
2. **Batch status endpoint** (aggregated progress for all 6 reels)
3. **Clip assignment logic** (round-robin from clip pool by relevance)
4. **Frontend GenerateStep** with generate button
5. **Frontend ProgressView** with per-reel status cards
6. **Frontend ReelGrid** showing completed reels

### Files Created/Modified

```
backend/app/
  api/
    generation.py                      # Added: POST /generate, GET /batch-status/{batch}

frontend/src/
  api/
    generationApi.ts                   # Generate, batch status, reels, download API calls
  components/generation/
    GenerateStep.tsx                    # Generate button + state machine
    ProgressView.tsx                    # Real-time batch progress
    ReelCard.tsx                        # Individual reel status card
    ReelGrid.tsx                        # Completed reels grid
```

### Batch Generation Flow

```
POST /api/projects/{id}/generate
    |
    v
Backend:
  1. Verify project has audio + lyrics
  2. Assign clips from pool (round-robin by relevance_score)
  3. Create 6 GeneratedReel records (one per text style)
  4. Dispatch 6 Celery render tasks
  5. Set project status to "generating"
  6. Return batch_number + reel_ids + job_ids
    |
    v
Frontend polls GET /batch-status/{batch} every 2 seconds:
  {
    "total": 6,
    "queued": 0,
    "rendering": 2,
    "complete": 3,
    "failed": 1,
    "all_complete": false,
    "reels": [...]
  }
    |
    v
When all_complete = true:
  Project status -> "complete"
  Show ReelGrid with download options
```

### Progress View UI

```
+------------------------------------------+
|  Generating Reels - Batch #1             |
|  [=========>          ] 4/6 complete     |
|                                          |
|  +--------+  +--------+  +--------+     |
|  | Style 1 | | Style 2 | | Style 3 |    |
|  | Done    | | Done    | | 70%     |    |
|  +--------+  +--------+  +--------+     |
|  +--------+  +--------+  +--------+     |
|  | Style 4 | | Style 5 | | Style 6 |    |
|  | Queued  | | Done    | | Done    |    |
|  +--------+  +--------+  +--------+     |
+------------------------------------------+
```

### How to Test Phase 12

```bash
# Generate full batch of 6 reels
curl -X POST http://localhost:61278/api/projects/{id}/generate
# Expected: {"batch_number": 1, "reel_ids": [...6 ids], "job_ids": [...6 ids], "total": 6}

# Check batch status
curl http://localhost:61278/api/projects/{id}/batch-status/1
# Expected: {"total": 6, "queued": N, "rendering": N, "complete": N, ...}

# Poll until all complete
watch -n 2 "curl -s http://localhost:61278/api/projects/{id}/batch-status/1 | python3 -m json.tool"
# Watch progress in real-time

# Check project status after completion
curl http://localhost:61278/api/projects/{id}
# Expected: status = "complete"

# List all reels
curl http://localhost:61278/api/projects/{id}/reels
# Expected: {"reels": [6 reel objects], "total": 6}

# Frontend test: Step 7
# - Click "Generate Reels" button
# - Watch progress cards update in real-time
# - Each card shows its style name and progress %
# - On completion, switches to ReelGrid view
# - Each reel has a preview and download option
```

---

## Phase 13: Download, Polish & Error Handling

### What This Phase Is

Add the zip download feature, toast notification system, error boundaries, retry logic, and overall UI polish. This phase transforms a functional prototype into a robust, user-friendly application.

### What You Build

1. **Zip download endpoint** (bundle all completed reels)
2. **Toast notification system** (global success/error/info/warning)
3. **React Error Boundary** (catch-all for component crashes)
4. **Axios retry interceptor** (auto-retry on transient errors)
5. **Poll error recovery** (resume after connection failures)
6. **Loading skeletons** for all data-loading states
7. **Responsive design** refinements

### Files Created/Modified

```
backend/app/
  api/
    generation.py                      # Added: GET /download-zip endpoint

frontend/src/
  store/
    toastStore.ts                      # Global toast state (Zustand)
  components/shared/
    Toast.tsx                          # Toast container + individual toasts
    ErrorBoundary.tsx                  # React Error Boundary
    Modal.tsx                          # Reusable modal dialog
    Button.tsx                         # Reusable button with variants
    ProjectCard.tsx                    # Project list card
  api/
    apiClient.ts                       # Updated: retry interceptor, error toasts
  components/generation/
    ProgressView.tsx                   # Updated: poll error recovery
    ReelGrid.tsx                       # Updated: download zip button
```

### Toast System

```typescript
// Available anywhere in the app:
toast.success('Project created!')
toast.error('Upload failed')
toast.info('Processing...')
toast.warning('Low quality audio')

// Features:
// - Max 5 stacked toasts
// - Auto-dismiss (success: 4s, error: 6s)
// - Color-coded (green/red/blue/amber)
// - Slide-in animation
// - Manual dismiss button
```

### Retry Logic (Axios Interceptor)

```
GET request fails with 502/503/504/408
    |
    v
Wait 1 second -> Retry #1
    |
    v (if still fails)
Wait 2 seconds -> Retry #2
    |
    v (if still fails)
Show error toast -> Promise rejects
```

### Zip Download

```
GET /api/projects/{id}/download-zip
    |
    v
Backend:
  1. Find latest batch of reels
  2. Filter to "complete" status only
  3. Download each reel from R2
  4. Bundle into zip: {ProjectName}_style{N}_reel.mp4
  5. Stream zip response to browser
    |
    v
Browser downloads: "Project_Name_reels_batch1.zip"
```

### How to Test Phase 13

```bash
# Download zip (project must have completed reels)
curl -o reels.zip http://localhost:61278/api/projects/{id}/download-zip
# Expected: ZIP file downloaded
# In mock mode: may be small/empty since no real videos

# Test error handling - request non-existent project
curl http://localhost:61278/api/projects/00000000-0000-0000-0000-000000000000
# Expected: 404 with {"detail": "Project not found"}

# Test validation error
curl -X POST http://localhost:61278/api/projects \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 422 with readable error message

# Frontend tests:
# 1. Toast - Create a project, see green success toast
# 2. Toast - Try an invalid action, see red error toast
# 3. Error Boundary - If any component crashes, see fallback UI with "Try Again"
# 4. Loading - Navigate to any page, see loading skeleton before data loads
# 5. Download - On completed project, click "Download All" for zip
# 6. Responsive - Resize browser to mobile width, all layouts should adapt
```

---

## Phase 14: Frontend UI - Full Wizard Flow

### What This Phase Is

Build the complete frontend application with all pages and the multi-step project wizard. This connects every previous phase into a seamless user experience.

### What You Build

1. **5 page components** (list, new, detail, flow, 404)
2. **Multi-step wizard** (7 steps in ProjectFlowPage)
3. **Project store** (Zustand state management)
4. **Routing** (React Router v6)
5. **Complete UI** with all domain components wired together

### Files Created

```
frontend/src/
  App.tsx                              # Router + ErrorBoundary + ToastContainer
  App.css                              # App-level styles
  pages/
    ProjectListPage.tsx                # Dashboard with project cards
    NewProjectPage.tsx                 # Create project form
    ProjectDetailPage.tsx              # Project details view
    ProjectFlowPage.tsx                # 7-step wizard (main flow)
    NotFoundPage.tsx                   # 404 page
  store/
    projectStore.ts                    # Active project state
  hooks/
    useProject.ts                      # Project loading hook
  api/
    projectsApi.ts                     # Project CRUD API calls
    textStylesApi.ts                   # Text styles API calls
```

### Routing Map

| URL | Page | What User Sees |
|-----|------|---------------|
| `/` | ProjectListPage | Dashboard with all projects as cards |
| `/projects/new` | NewProjectPage | "New Project" form with name input |
| `/projects/:id` | ProjectDetailPage | Read-only project details |
| `/projects/:id/flow` | ProjectFlowPage | 7-step interactive wizard |
| `*` | NotFoundPage | "404 - Page not found" |

### Wizard Steps (ProjectFlowPage)

```
Step 1: Upload Audio        -> AudioUploader component
Step 2: Trim Audio          -> AudioTrimmer component
Step 3: Transcribe          -> TranscriptionProgress component
Step 4: Review Lyrics       -> LyricsReviewDashboard component
Step 5: Set Vibe            -> VibeInput + KeywordEditor components
Step 6: Visual Setup        -> VisualModeSelector + ClipPoolGallery components
Step 7: Generate            -> GenerateStep (ProgressView | ReelGrid) components
```

### Step Auto-Detection

The wizard automatically jumps to the appropriate step based on project status:

| Project Status | Auto-Jump To |
|----------------|-------------|
| `draft` (no audio) | Step 1: Upload |
| `draft` (audio, not trimmed) | Step 2: Trim |
| `draft` (trimmed, not transcribed) | Step 3: Transcribe |
| `transcribed` | Step 4: Review Lyrics |
| `vibe_set` | Step 6: Visual Setup |
| `generating` | Step 7: Generate (ProgressView) |
| `complete` | Step 7: Generate (ReelGrid) |

### How to Test Phase 14

**Full End-to-End User Flow:**

```
1. Open http://localhost:61278
   -> See empty project dashboard
   -> Click "+ New Project"

2. Enter project name: "My First Reel"
   -> Click "Create Project"
   -> Toast: "Project created!"
   -> Auto-redirect to wizard

3. Step 1: Upload Audio
   -> Click upload area or drag & drop an audio file
   -> See waveform preview after upload
   -> Click "Next"

4. Step 2: Trim Audio
   -> See full waveform with draggable region
   -> Drag handles to select 30-second segment
   -> Click "Trim & Continue"

5. Step 3: Transcribe
   -> See progress bar filling up
   -> Automatic: polls job status every 2 seconds
   -> On completion, auto-advances to Step 4

6. Step 4: Review Lyrics
   -> See 3-panel layout: word list, timeline, preview
   -> Click words to edit text
   -> Drag timeline blocks to adjust timing
   -> See live preview on black background
   -> Click "Save & Continue"

7. Step 5: Set Vibe
   -> Click "AI Suggest" for auto-generated vibe
   -> Or type your own vibe description
   -> Click "Set Vibe"
   -> Keywords auto-extracted and shown as chips
   -> Edit keywords if needed (3-10)
   -> Click "Continue"

8. Step 6: Visual Setup
   -> Choose "Stock Video" or "Custom Video"
   -> If Stock: Click "Build Pool" to search Pexels
   -> Watch pool building progress
   -> See clip gallery sorted by relevance
   -> Click "Continue"

9. Step 7: Generate
   -> Click "Generate Reels" button
   -> Watch 6 progress cards update in real-time
   -> Each shows style name and % complete
   -> On completion, see ReelGrid
   -> Click "Download All" for zip file
   -> Or click individual reels to download

10. Return to dashboard -> See project with "Complete" badge
```

---

## Final Steps: Push & Deploy

### Push to GitHub

```bash
# Initialize git (if not already done)
git init
git remote add origin https://github.com/YourUsername/Reels-Generator.git

# Stage all files (excluding .gitignore patterns)
git add .

# Commit
git commit -m "feat: Doles Reels Generator V1 - Complete implementation

14-phase build including:
- React 18 + Vite + TypeScript frontend with Tailwind CSS v4
- FastAPI backend with async SQLAlchemy + Celery workers
- FFmpeg video compositing with 6 text animation styles
- WhisperX transcription with word-level timing
- Claude AI vibe analysis and keyword extraction
- Pexels stock video integration with AI-ranked clip pool
- Docker Compose with 6 services + Nginx gateway
- Full mock mode for development without API keys

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Push
git push -u origin main
```

### Deploy for Production

```bash
# 1. Set real API keys in backend/.env
PEXELS_API_KEY=your_real_key
ANTHROPIC_API_KEY=your_real_key
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=doles-reels
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# 2. Build and start
docker compose up -d --build

# 3. Run migrations
docker compose exec backend alembic upgrade head

# 4. Verify
curl http://localhost:61278/api/health
# r2_configured should now be true
```

### Useful Commands Reference

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f celery_worker

# Restart a service
docker compose restart backend
docker compose restart celery_worker

# Rebuild everything
docker compose up -d --build

# Stop everything (keep data)
docker compose down

# Stop everything (DESTROY data)
docker compose down -v

# Scale Celery workers for more render throughput
docker compose up -d --scale celery_worker=3

# Database backup
docker compose exec postgres pg_dump -U user doles_reels > backup.sql

# Database reset
docker compose down -v && docker compose up -d --build && docker compose exec backend alembic upgrade head
```

---

## Architecture Reference

### System Architecture Diagram

```
                    +-----------------------------------+
                    |            Nginx                   |
                    |        (Port 61278)                |
                    |   /  -> frontend:5173              |
                    |   /api -> backend:8000             |
                    +--------+----------------+---------+
                             |                |
                    +--------v---+    +-------v--------+
                    |  Frontend  |    |    Backend      |
                    |  React 18  |    |    FastAPI      |
                    |  Vite      |    |    Uvicorn      |
                    |  TS + TW4  |    |    Python 3.11  |
                    +------------+    +-------+---------+
                                              |
                          +-------------------+-------------------+
                          |                   |                   |
                  +-------v------+    +-------v------+    +------v-------+
                  |  PostgreSQL  |    |    Redis     |    | Cloudflare   |
                  |    16        |    |     7        |    |     R2       |
                  +--------------+    +------+-------+    +--------------+
                                             |
                                     +-------v-------+
                                     | Celery Worker  |
                                     | (concurrency=3)|
                                     +-------+-------+
                                             |
                              +--------------+--------------+
                              |              |              |
                        +-----v-----+  +-----v-----+  +---v-------+
                        | Claude AI |  |  Pexels   |  | WhisperX  |
                        |   API     |  |   API     |  | (local)   |
                        +-----------+  +-----------+  +-----------+
```

### Data Flow Summary

```
Audio Upload -> R2 Storage -> Trim (FFmpeg) -> R2 Storage
    |
    v
Transcription (WhisperX via Celery) -> Lyrics in PostgreSQL
    |
    v
Vibe Analysis (Claude AI) -> Keywords extracted
    |
    v
Stock Video Search (Pexels API) -> Clip Pool (ranked by Claude AI)
    |
    v
Render Pipeline (FFmpeg via Celery):
  Video Clip + Trimmed Audio + Text Style Filter -> 1080x1920 MP4
    |
    v
6 Rendered Reels -> R2 Storage -> Zip Download
```

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4, Zustand, WaveSurfer.js v7 |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.x (async) |
| Database | PostgreSQL 16 |
| Task Queue | Celery 5.4, Redis 7 |
| Audio/Video | FFmpeg 6+, Librosa, Pillow |
| AI | Claude claude-sonnet-4-20250514 (Anthropic), WhisperX |
| Storage | Cloudflare R2 (S3-compatible) |
| Stock Video | Pexels Video API |
| Infrastructure | Docker Compose, Nginx |

---

**Built by the Doles Music team. Internal tool - not for public distribution.**
