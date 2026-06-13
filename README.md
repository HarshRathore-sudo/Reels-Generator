# Doles Reels Generator V1

Internal web tool for the **Doles Music** team. Upload a 30-second audio clip, auto-transcribe lyrics with word-level timing, describe the vibe, and the system generates **6 ready-to-post Instagram reels** (1080x1920) with synced lyrics over aesthetic stock video backgrounds.

Built for 5-10 internal team members. No authentication required in V1.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [User Workflow](#user-workflow)
- [API Overview](#api-overview)
- [Text Styles](#text-styles)
- [Mock Mode](#mock-mode)
- [Additional Documentation](#additional-documentation)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Audio Upload & Trim** - Upload audio files (MP3, WAV, M4A, etc.) and trim to a 30-second segment with interactive waveform visualization via WaveSurfer.js
- **Auto-Transcription** - Word-level transcription with precise timing using WhisperX, supporting Hindi (Devanagari), Hindi (Romanized), and English
- **Lyrics Review Dashboard** - Interactive timeline to review, edit word text, adjust timing, and reassign line breaks before rendering
- **Beat Detection** - Automatic tempo estimation and beat timestamp extraction using Librosa for rhythm-synced visuals
- **AI Vibe Analysis** - Claude AI suggests vibe descriptions based on lyrics and tempo, then auto-extracts visual search keywords
- **Stock Video Sourcing** - Pexels API integration with AI-powered clip ranking for aesthetic relevance
- **6 Text Styles** - Each batch generates 6 reels with distinct typography: Minimal Fade, Karaoke Highlight, Word Pop, Typewriter, Stacked Lines, and Cinematic Subtitle
- **FFmpeg Render Pipeline** - 7-stage Celery-based render worker compositing video, audio, and animated text overlays
- **Batch Generation** - One-click generation of 6 reels with real-time progress tracking
- **Zip Download** - Download all completed reels in a single zip archive
- **Toast Notifications** - Global notification system for success, error, and info feedback
- **Error Recovery** - Retry logic on API calls, poll error recovery, and React Error Boundary
- **Responsive Design** - Mobile-first layouts with breakpoints for all screen sizes

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS v4, Zustand, React Router v6, WaveSurfer.js v7, Axios |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.x (async), Alembic |
| **Database** | PostgreSQL 16 |
| **Task Queue** | Celery 5.4, Redis 7 |
| **Audio/Video** | FFmpeg 6+, Librosa 0.10.2, Pillow 11 |
| **AI/ML** | Anthropic Claude API (claude-sonnet-4-20250514), WhisperX |
| **Storage** | Cloudflare R2 (S3-compatible) via Boto3 |
| **Stock Video** | Pexels Video API |
| **Infrastructure** | Docker Compose, Nginx (reverse proxy) |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose v2+
- (Optional) API keys for full functionality - runs in [mock mode](#mock-mode) without them

### 1. Clone and Configure

```bash
git clone <repo-url>
cd doles-reels-generator
```

Copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials (see [DEPLOYMENT.md](DEPLOYMENT.md) for details):

```env
# Required for infrastructure (defaults work with Docker Compose)
DATABASE_URL=postgresql://user:pass@postgres:5432/doles_reels
REDIS_URL=redis://redis:6379/0

# Optional - runs in mock mode if not set
PEXELS_API_KEY=your_pexels_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional - Cloudflare R2 storage (mock mode if not set)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=doles-reels
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
```

### 2. Start Services

```bash
docker compose up -d --build
```

This starts 6 services:

| Service | Description | Port |
|---------|-------------|------|
| **nginx** | Reverse proxy gateway | 61278 (external) |
| **frontend** | React dev server (Vite HMR) | 5173 (internal) |
| **backend** | FastAPI with Uvicorn | 8000 (internal) |
| **postgres** | PostgreSQL 16 | 5432 (internal) |
| **redis** | Redis 7 | 6379 (internal) |
| **celery_worker** | Celery worker (concurrency=3) | - |

### 3. Run Database Migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Access the App

Open **http://localhost:61278** in your browser.

### 5. Verify Health

```bash
curl http://localhost:61278/api/health
# {"status":"ok","service":"doles-reels-generator","r2_configured":false}
```

---

## Project Structure

```
doles-reels-generator/
├── frontend/                    React + TypeScript + Tailwind CSS v4
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.tsx              App root with ErrorBoundary + Router
│       ├── main.tsx             Entry point
│       ├── index.css            Global styles + Tailwind directives
│       ├── api/                 API client modules
│       │   ├── apiClient.ts     Axios instance with retry logic
│       │   ├── projectsApi.ts   Project CRUD calls
│       │   ├── audioApi.ts      Upload, trim, transcribe calls
│       │   ├── lyricsApi.ts     Lyrics fetch/update calls
│       │   ├── vibeApi.ts       Vibe set/suggest, keywords calls
│       │   ├── visualApi.ts     Visual mode, clip pool calls
│       │   ├── textStylesApi.ts Text style listing calls
│       │   └── generationApi.ts Generate, batch status, download calls
│       ├── pages/               Route page components
│       │   ├── ProjectListPage.tsx   Dashboard with project cards
│       │   ├── NewProjectPage.tsx    Create project form
│       │   ├── ProjectFlowPage.tsx   Multi-step wizard (main flow)
│       │   ├── ProjectDetailPage.tsx Project details view
│       │   └── NotFoundPage.tsx      404 page
│       ├── components/          UI components by domain
│       │   ├── audio/           AudioUploader, AudioTrimmer, WaveformPreview
│       │   ├── lyrics/          LyricsReviewDashboard, WordTimeline, TextStylePicker
│       │   ├── vibe/            VibeInput, KeywordEditor
│       │   ├── visual/          VisualModeSelector, ClipPoolGallery, CustomVideoInput
│       │   ├── generation/      GenerateStep, ProgressView, ReelGrid, ReelCard
│       │   └── shared/          Button, Modal, Toast, ErrorBoundary, ProjectCard
│       ├── store/               Zustand state management
│       │   ├── projectStore.ts  Project data + actions
│       │   └── toastStore.ts    Global toast notifications
│       ├── hooks/               Custom React hooks
│       │   ├── useProject.ts    Project loading hook
│       │   ├── useAudioUpload.ts Audio upload logic
│       │   └── useWordTimeline.ts Word timeline interactions
│       └── types/               TypeScript type definitions
│           └── index.ts         All shared interfaces + enums
│
├── backend/                     Python + FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                 Database migrations
│   │   └── versions/            Migration scripts
│   ├── fonts/                   Font files for text rendering
│   │   ├── Inter-Bold.ttf
│   │   ├── Inter-Regular.ttf
│   │   ├── NotoSansDevanagari-Bold.ttf
│   │   └── NotoSansDevanagari-Regular.ttf
│   └── app/
│       ├── main.py              FastAPI app with middleware + error handlers
│       ├── api/                 Route handlers
│       │   ├── __init__.py      Router registration
│       │   ├── projects.py      CRUD endpoints
│       │   ├── audio.py         Upload, trim, transcribe, beats
│       │   ├── lyrics.py        Get/update lyrics
│       │   ├── vibe.py          Vibe set/suggest, keywords
│       │   ├── visual.py        Visual mode, clip pool
│       │   ├── generation.py    Render, generate, batch status, download
│       │   ├── text_styles.py   Style listing and preview
│       │   └── jobs.py          Celery job status polling
│       ├── models/              SQLAlchemy ORM models
│       │   └── db_models.py     Project, AudioFile, Lyrics, ClipPool, GeneratedReel
│       ├── schemas/             Pydantic v2 request/response schemas
│       │   ├── project.py       ProjectCreate, ProjectResponse
│       │   ├── audio.py         Upload, Trim, Transcribe schemas
│       │   ├── lyrics.py        LyricsResponse, LyricsUpdateRequest
│       │   ├── vibe.py          VibeRequest, KeywordsUpdateRequest
│       │   ├── visual.py        VisualMode, ClipPool schemas
│       │   └── generation.py    Render, Batch schemas
│       ├── services/            Business logic services
│       │   ├── r2_service.py    Cloudflare R2 storage (with mock)
│       │   ├── claude_service.py Claude AI (vibe, keywords, ranking)
│       │   ├── pexels_service.py Pexels video search (with mock)
│       │   ├── ffmpeg_service.py FFmpeg render pipeline
│       │   ├── text_render_service.py Text style orchestration
│       │   ├── librosa_service.py Beat detection
│       │   ├── transcription_service.py WhisperX transcription
│       │   ├── whisperx_service.py WhisperX wrapper
│       │   └── ytdlp_service.py  Video download utility
│       ├── workers/             Celery background tasks
│       │   ├── celery_app.py    Celery configuration
│       │   ├── render_worker.py 7-stage reel render task
│       │   ├── transcription_worker.py Audio transcription task
│       │   └── pool_builder_worker.py Clip pool build task
│       ├── text_styles/         6 FFmpeg drawtext renderers
│       │   ├── base.py          Base text style class
│       │   ├── style_1_minimal_fade.py
│       │   ├── style_2_karaoke.py
│       │   ├── style_3_word_pop.py
│       │   ├── style_4_typewriter.py
│       │   ├── style_5_stacked.py
│       │   └── style_6_cinematic.py
│       ├── prompts/             Claude API prompt templates
│       │   ├── vibe_suggestion.txt
│       │   ├── keyword_extraction.txt
│       │   └── clip_ranking.txt
│       └── core/                Configuration and database
│           ├── config.py        Pydantic Settings
│           ├── database.py      Async SQLAlchemy engine
│           └── sync_database.py Sync engine for Celery workers
│
├── docker-compose.yml           6-service orchestration
├── nginx.conf                   Reverse proxy configuration
├── .env                         Root environment (Docker infra)
└── .gitignore
```

---

## User Workflow

The project follows a linear 7-step flow, managed by the `ProjectFlowPage` wizard:

```
Step 1: Upload Audio
    └── Upload MP3/WAV/M4A file, preview waveform
        └── Step 2: Trim Audio
            └── Select 30-second segment with interactive waveform regions
                └── Step 3: Transcribe
                    └── Auto-transcribe with WhisperX (Hindi/English)
                        └── Step 4: Review Lyrics
                            └── Edit words, adjust timing, reassign lines
                                └── Step 5: Set Vibe
                                    └── Describe the mood, AI extracts keywords
                                        └── Step 6: Visual Setup
                                            └── Choose stock/custom, build clip pool
                                                └── Step 7: Generate
                                                    └── Create 6 reels, track progress, download
```

### Project Status Flow

| Status | Meaning | Triggered By |
|--------|---------|-------------|
| `draft` | Project created, no audio | Project creation |
| `transcribed` | Audio uploaded, trimmed, and transcribed | Transcription completion |
| `vibe_set` | Vibe description and keywords saved | Vibe submission |
| `generating` | Reel batch is being rendered | Generate action |
| `complete` | All reels in latest batch finished | Batch completion |

---

## API Overview

All endpoints are prefixed with `/api`. See [backend/API_REFERENCE.md](backend/API_REFERENCE.md) for full documentation.

### Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| **Projects** | | |
| `POST` | `/projects` | Create project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/:id` | Get project |
| `DELETE` | `/projects/:id` | Delete project |
| **Audio** | | |
| `POST` | `/projects/:id/audio/upload-url` | Get presigned upload URL |
| `POST` | `/projects/:id/audio/confirm` | Confirm upload |
| `GET` | `/projects/:id/audio` | Get audio metadata |
| `GET` | `/projects/:id/audio/download-url` | Get download URL |
| `POST` | `/projects/:id/audio/trim` | Trim audio segment |
| `POST` | `/projects/:id/audio/transcribe` | Start transcription job |
| `POST` | `/projects/:id/audio/beats` | Run beat detection |
| **Lyrics** | | |
| `GET` | `/projects/:id/lyrics` | Get lyrics with timing |
| `PUT` | `/projects/:id/lyrics` | Update lyrics/timing |
| **Vibe** | | |
| `POST` | `/projects/:id/vibe` | Set vibe + extract keywords |
| `POST` | `/projects/:id/vibe/suggest` | AI vibe suggestion |
| `GET` | `/projects/:id/keywords` | Get keywords |
| `PUT` | `/projects/:id/keywords` | Update keywords |
| **Visual** | | |
| `POST` | `/projects/:id/visual-mode` | Set visual mode |
| `POST` | `/projects/:id/custom-video` | Submit custom video URL |
| `POST` | `/projects/:id/clips/build-pool` | Build clip pool |
| `GET` | `/projects/:id/clips` | Get clip pool |
| **Generation** | | |
| `POST` | `/projects/:id/render-single` | Render single test reel |
| `POST` | `/projects/:id/generate` | Generate batch of 6 reels |
| `GET` | `/projects/:id/batch-status/:batch` | Batch progress |
| `GET` | `/projects/:id/reels` | List all reels |
| `GET` | `/projects/:id/reels/:reel_id` | Get reel details |
| `GET` | `/projects/:id/download-zip` | Download reels as zip |
| **Text Styles** | | |
| `GET` | `/text-styles` | List all styles |
| `GET` | `/text-styles/:id` | Get style info |
| `POST` | `/text-styles/preview` | Preview filter string |
| **Jobs** | | |
| `GET` | `/jobs/:job_id` | Poll job status |

---

## Text Styles

Each batch generates 6 reels, one per text style:

| # | Style | Description |
|---|-------|-------------|
| 1 | **Minimal Fade** | Clean fade-in/fade-out of each word, centered |
| 2 | **Karaoke Highlight** | Words highlight sequentially as they're sung |
| 3 | **Word Pop** | Each word pops in with scale animation |
| 4 | **Typewriter** | Words appear one-by-one as if typed |
| 5 | **Stacked Lines** | Full lines stack from bottom to top |
| 6 | **Cinematic Subtitle** | Movie-style subtitles at the bottom |

All styles support **Hindi (Devanagari)**, **Hindi (Romanized)**, and **English** through font path resolution (Inter for Latin, Noto Sans Devanagari for Hindi).

---

## Mock Mode

When API keys are not configured, the system automatically runs in **mock mode**:

| Service | Mock Behavior |
|---------|---------------|
| **R2 Storage** | Returns fake presigned URLs, simulates upload/download |
| **Claude AI** | Returns preset vibe suggestions and sample keywords |
| **Pexels API** | Returns mock video clip metadata |
| **WhisperX** | Returns sample word-level transcription |
| **FFmpeg Render** | Generates a 5-second color-source test video |

Mock mode is ideal for development and testing without incurring API costs.

---

## Additional Documentation

| Document | Description |
|----------|-------------|
| [backend/API_REFERENCE.md](backend/API_REFERENCE.md) | Complete API endpoint reference with request/response examples |
| [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md) | System architecture, services, render pipeline, and data flow |
| [frontend/FRONTEND_GUIDE.md](frontend/FRONTEND_GUIDE.md) | Component hierarchy, state management, and UI patterns |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker setup, environment variables, and operations guide |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 61278 in use** | Stop conflicting service: `lsof -i :61278` then kill the PID |
| **Database connection fails** | Wait for postgres healthcheck: `docker compose logs postgres` |
| **Frontend not loading** | Check nginx: `docker compose logs nginx` |
| **Celery not processing** | Check worker: `docker compose logs celery_worker` |
| **Transcription hangs** | Check job status via `/api/jobs/{job_id}`, restart worker if needed |
| **Render fails** | Check celery logs for FFmpeg errors, ensure fonts are present |
| **R2 mock mode active** | Set `R2_ACCOUNT_ID` and other R2 vars in `backend/.env` |
| **No vibe suggestions** | Set `ANTHROPIC_API_KEY` in `backend/.env` for Claude API access |

### Useful Commands

```bash
# View all service logs
docker compose logs -f

# Restart a specific service
docker compose restart backend

# Rebuild and restart everything
docker compose up -d --build

# Run database migrations
docker compose exec backend alembic upgrade head

# Create a new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Check service health
curl http://localhost:61278/api/health

# Connect to database
docker compose exec postgres psql -U user -d doles_reels

# Clear Redis cache
docker compose exec redis redis-cli FLUSHALL

# Check Celery worker status
docker compose exec celery_worker celery -A app.workers.celery_app inspect active
```

---

## License

Internal tool - Doles Music. Not for public distribution.
