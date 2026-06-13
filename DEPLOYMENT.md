# Deployment Guide

Docker setup, environment configuration, and operations guide for the Doles Reels Generator.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy](#quick-deploy)
- [Docker Compose Services](#docker-compose-services)
- [Environment Variables](#environment-variables)
- [Nginx Configuration](#nginx-configuration)
- [Database Management](#database-management)
- [Development Workflow](#development-workflow)
- [Monitoring & Logs](#monitoring--logs)
- [Service Management](#service-management)
- [Data & Storage](#data--storage)
- [Production Considerations](#production-considerations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum Version |
|-------------|-----------------|
| Docker | 24.0+ |
| Docker Compose | v2.0+ (integrated `docker compose`) |
| Disk Space | 2GB+ (Docker images + volumes) |
| RAM | 4GB+ recommended |

### Optional (for full functionality)

| Service | Signup URL |
|---------|-----------|
| Pexels API Key | https://www.pexels.com/api/ (free) |
| Anthropic API Key | https://console.anthropic.com/ |
| Cloudflare R2 | https://dash.cloudflare.com/ |

Without these keys, the system runs in **mock mode** (see [Mock Mode](#mock-mode)).

---

## Quick Deploy

```bash
# 1. Clone the repository
git clone <repo-url>
cd doles-reels-generator

# 2. Create environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (optional)

# 3. Build and start all services
docker compose up -d --build

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. Verify
curl http://localhost:61278/api/health
```

The app is now available at **http://localhost:61278**.

---

## Docker Compose Services

### Service Overview

```yaml
services:
  nginx:          # Reverse proxy (port 61278 -> frontend + backend)
  frontend:       # React dev server (Vite, port 5173 internal)
  backend:        # FastAPI server (Uvicorn, port 8000 internal)
  postgres:       # PostgreSQL 16 database
  redis:          # Redis 7 message broker
  celery_worker:  # Background task processor
```

### Service Details

| Service | Image | Ports | Volumes | Healthcheck |
|---------|-------|-------|---------|-------------|
| **nginx** | `nginx:alpine` | `61278:80` | `./nginx.conf` (read-only) | - |
| **frontend** | Custom (Node 20) | `5173` (internal) | `./frontend/src`, `./frontend/index.html` | - |
| **backend** | Custom (Python 3.11) | `8000` (internal) | `./backend/app`, `./backend/alembic` | - |
| **postgres** | `postgres:16-alpine` | `5432` (internal) | `pgdata` (named volume) | `pg_isready` every 5s |
| **redis** | `redis:7-alpine` | `6379` (internal) | `redisdata` (named volume) | `redis-cli ping` every 5s |
| **celery_worker** | Same as backend | - | `./backend/app` | - |

### Dependency Graph

```
nginx
├── frontend
└── backend
    ├── postgres (healthy)
    └── redis (healthy)

celery_worker
├── postgres (healthy)
└── redis (healthy)
```

### Container Restart Policy

All services use `restart: unless-stopped` - they automatically restart on crashes but not after manual stop.

---

## Environment Variables

### Backend Environment (`backend/.env`)

Copy `backend/.env.example` and configure:

#### Database & Redis (Required)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/doles_reels` | PostgreSQL connection string. Uses Docker service name `postgres`. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection for Celery broker and result backend. Uses Docker service name `redis`. |

These defaults work with Docker Compose out of the box.

#### Cloudflare R2 Storage (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `R2_ACCOUNT_ID` | `""` | Cloudflare account ID. Empty = mock mode. |
| `R2_ACCESS_KEY_ID` | `""` | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | `""` | R2 secret access key |
| `R2_BUCKET_NAME` | `doles-reels` | R2 bucket name |
| `R2_ENDPOINT` | `""` | R2 endpoint URL (e.g., `https://{account_id}.r2.cloudflarestorage.com`) |
| `R2_PUBLIC_URL` | `""` | Optional public URL for R2 bucket (custom domain) |

**Mock Mode**: When `R2_ACCOUNT_ID` is empty, storage operations return fake URLs and simulate uploads/downloads.

#### External APIs (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEXELS_API_KEY` | `""` | Pexels video API key. Empty = mock clips. |
| `ANTHROPIC_API_KEY` | `""` | Anthropic Claude API key. Empty = mock AI responses. |

#### Application URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:8000` | Backend URL (for CORS) |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL (for CORS) |

### Frontend Environment

Set via `docker-compose.yml`:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `/api` | API base URL (relative, proxied through Nginx) |

### Mock Mode

Services automatically fall back to mock mode when their API keys are empty:

| Service | Mock Trigger | Mock Behavior |
|---------|-------------|---------------|
| **R2 Storage** | `R2_ACCOUNT_ID` empty | Fake presigned URLs, simulated storage |
| **Claude AI** | `ANTHROPIC_API_KEY` empty | Preset vibe suggestions, sample keywords |
| **Pexels** | `PEXELS_API_KEY` empty | Mock video clip metadata |
| **WhisperX** | N/A (local) | Mock transcription if audio empty |
| **FFmpeg** | N/A (always available) | Uses color source if no video clip |

The health endpoint shows R2 status:
```json
GET /api/health
{"status": "ok", "r2_configured": false}
```

---

## Nginx Configuration

Nginx serves as the gateway on port `61278`:

```nginx
server {
    listen 80;
    server_name localhost;
    client_max_body_size 100M;      # Allow large audio uploads

    location / {
        proxy_pass http://frontend:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';    # WebSocket for Vite HMR
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;                  # Long timeout for renders
        proxy_connect_timeout 75s;
    }
}
```

**Key Settings**:
- `client_max_body_size 100M` - Required for audio file uploads
- `proxy_read_timeout 300s` - Allows long-running API calls (FFmpeg operations)
- WebSocket headers - Required for Vite HMR in development

---

## Database Management

### Running Migrations

```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Check current migration status
docker compose exec backend alembic current

# View migration history
docker compose exec backend alembic history

# Create a new auto-generated migration
docker compose exec backend alembic revision --autogenerate -m "add column description"

# Rollback one migration
docker compose exec backend alembic downgrade -1

# Rollback to a specific revision
docker compose exec backend alembic downgrade abc123
```

### Direct Database Access

```bash
# Connect via psql
docker compose exec postgres psql -U user -d doles_reels

# List tables
\dt

# View projects
SELECT id, name, status FROM projects ORDER BY created_at DESC;

# View generated reels
SELECT id, text_style, render_status, batch_number FROM generated_reels;

# Count records
SELECT
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM audio_files) AS audio_files,
  (SELECT COUNT(*) FROM lyrics) AS lyrics,
  (SELECT COUNT(*) FROM clip_pool) AS clips,
  (SELECT COUNT(*) FROM generated_reels) AS reels;
```

### Database Reset

```bash
# WARNING: This destroys all data
docker compose down -v              # Remove volumes
docker compose up -d --build        # Recreate
docker compose exec backend alembic upgrade head   # Re-run migrations
```

---

## Development Workflow

### Hot Reload

Volume mounts enable hot reload without rebuilding containers:

| Service | Mounted Path | Reload Method |
|---------|-------------|---------------|
| Frontend | `./frontend/src` -> `/app/src` | Vite HMR (instant) |
| Frontend | `./frontend/index.html` -> `/app/index.html` | Vite HMR |
| Backend | `./backend/app` -> `/app/app` | Uvicorn `--reload` |
| Celery | `./backend/app` -> `/app/app` | Requires `docker compose restart celery_worker` |

**Important**: `vite.config.ts`, `package.json`, `requirements.txt`, and `Dockerfile` changes require a rebuild:
```bash
docker compose up -d --build
```

### Adding Python Dependencies

```bash
# 1. Add to requirements.txt
echo "new-package==1.0.0" >> backend/requirements.txt

# 2. Rebuild backend + celery
docker compose up -d --build backend celery_worker
```

### Adding NPM Dependencies

```bash
# 1. Install in frontend container
docker compose exec frontend npm install new-package

# 2. Or rebuild
docker compose up -d --build frontend
```

### Code Changes

```bash
# Backend code changes (auto-reload with Uvicorn):
# Just edit files in backend/app/ - changes apply immediately

# Celery worker changes (must restart):
docker compose restart celery_worker

# Frontend code changes (auto-reload with Vite HMR):
# Just edit files in frontend/src/ - changes apply immediately
```

---

## Monitoring & Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f celery_worker
docker compose logs -f nginx

# Last N lines
docker compose logs --tail=50 backend

# Since timestamp
docker compose logs --since=5m backend
```

### Backend Request Logs

The backend logs all `/api` requests with timing:
```
INFO: GET /api/projects -> 200 (12ms)
INFO: POST /api/projects/uuid/generate -> 200 (45ms)
WARNING: Validation error on POST /api/projects: name: String should have at least 1 character
ERROR: Database error on GET /api/projects/uuid: ...
```

### Celery Task Logs

Celery worker logs show task execution:
```
INFO: Task render_reel[abc-123] received
INFO: [render_reel abc-123] Stage 1/7: Loading project data...
INFO: [render_reel abc-123] Stage 5/7: Running FFmpeg render...
INFO: Task render_reel[abc-123] succeeded in 12.34s
```

### Health Check

```bash
# API health
curl http://localhost:61278/api/health

# Docker service status
docker compose ps

# Resource usage
docker stats --no-stream
```

---

## Service Management

### Start/Stop

```bash
# Start all services
docker compose up -d

# Stop all services (keep data)
docker compose down

# Stop all services and remove volumes (DESTROYS DATA)
docker compose down -v
```

### Restart Individual Services

```bash
# Restart backend (picks up code changes via hot reload)
docker compose restart backend

# Restart celery worker (required for worker code changes)
docker compose restart celery_worker

# Restart frontend
docker compose restart frontend

# Restart nginx (required for nginx.conf changes)
docker compose restart nginx
```

### Rebuild

```bash
# Rebuild all services
docker compose up -d --build

# Rebuild specific service
docker compose up -d --build backend

# Force rebuild without cache
docker compose build --no-cache backend
docker compose up -d backend
```

### Scale Celery Workers

For more render throughput, increase worker count:
```bash
docker compose up -d --scale celery_worker=3
```

---

## Data & Storage

### Docker Volumes

| Volume | Service | Path | Content |
|--------|---------|------|---------|
| `pgdata` | postgres | `/var/lib/postgresql/data` | All database data |
| `redisdata` | redis | `/data` | Redis persistence |

### R2 Storage Structure

```
doles-reels/                            # R2 bucket
├── projects/
│   └── {project_id}/
│       ├── audio/
│       │   ├── original_{uuid}.mp3     # Uploaded audio
│       │   └── trimmed_{uuid}.mp3      # Trimmed segment
│       └── reels/
│           └── {reel_id}.mp4           # Rendered reel video
```

### Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U user doles_reels > backup.sql

# Restore PostgreSQL
docker compose exec -T postgres psql -U user doles_reels < backup.sql
```

---

## Production Considerations

### Security

- [ ] Add authentication (JWT/OAuth) for multi-user support
- [ ] Set specific CORS origins (not wildcard)
- [ ] Use secrets manager for API keys
- [ ] Enable HTTPS via Nginx SSL termination
- [ ] Set strong PostgreSQL credentials
- [ ] Rate limit API endpoints

### Performance

- [ ] Use production Vite build (`npm run build`) instead of dev server
- [ ] Replace Uvicorn `--reload` with production Gunicorn + Uvicorn workers
- [ ] Add PostgreSQL connection pooling (PgBouncer)
- [ ] Configure Redis persistence (AOF or RDB)
- [ ] Use CDN for rendered video delivery
- [ ] Add result caching for expensive operations

### Reliability

- [ ] Add container healthchecks for backend and frontend
- [ ] Configure proper logging aggregation (ELK/Loki)
- [ ] Set up alerting on task failures
- [ ] Add Celery task retry for transient errors
- [ ] Implement dead letter queue for failed tasks

### Scaling

- [ ] Separate Celery workers by queue (render vs transcription)
- [ ] Scale render workers independently: `docker compose up -d --scale celery_worker=5`
- [ ] Use managed PostgreSQL (RDS/Supabase)
- [ ] Use managed Redis (ElastiCache/Upstash)
- [ ] Add horizontal scaling with load balancer

---

## Troubleshooting

### Service Won't Start

```bash
# Check container status and errors
docker compose ps
docker compose logs backend

# Common: port conflict
lsof -i :61278
# Kill the conflicting process or change the port
```

### Database Connection Refused

```bash
# Wait for postgres healthcheck
docker compose logs postgres

# Check if healthy
docker compose ps postgres
# Should show "healthy"

# Restart dependent services after postgres is healthy
docker compose restart backend celery_worker
```

### Frontend Not Loading

```bash
# Check nginx logs
docker compose logs nginx

# Check frontend logs
docker compose logs frontend

# Verify nginx can reach frontend
docker compose exec nginx curl -s http://frontend:5173
```

### Celery Tasks Not Processing

```bash
# Check if worker is running
docker compose ps celery_worker

# Check worker logs
docker compose logs celery_worker

# Verify Redis connectivity
docker compose exec redis redis-cli ping
# Should return: PONG

# Check active tasks
docker compose exec celery_worker celery -A app.workers.celery_app inspect active

# Check registered tasks
docker compose exec celery_worker celery -A app.workers.celery_app inspect registered
```

### Render Fails

```bash
# Check celery worker logs for FFmpeg errors
docker compose logs celery_worker | grep -i "error\|failed\|ffmpeg"

# Check if fonts are present
docker compose exec backend ls -la /app/fonts/
# Should list: Inter-Bold.ttf, Inter-Regular.ttf, NotoSansDevanagari-Bold.ttf, NotoSansDevanagari-Regular.ttf

# Check if FFmpeg is installed
docker compose exec backend ffmpeg -version

# Check reel status in database
docker compose exec postgres psql -U user -d doles_reels -c \
  "SELECT id, text_style, render_status, error_message FROM generated_reels ORDER BY render_started_at DESC LIMIT 10;"
```

### Migration Issues

```bash
# Check current migration state
docker compose exec backend alembic current

# If migration fails, check for schema conflicts
docker compose exec backend alembic check

# Force reset to specific revision
docker compose exec backend alembic stamp head
```
