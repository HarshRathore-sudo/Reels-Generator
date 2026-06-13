# API Reference

Complete reference for the Doles Reels Generator REST API.

**Base URL**: `/api`

All endpoints return JSON. Errors follow the format:
```json
{ "detail": "Human-readable error message" }
```

---

## Table of Contents

- [Health Check](#health-check)
- [Projects](#projects)
- [Audio](#audio)
- [Lyrics](#lyrics)
- [Vibe & Keywords](#vibe--keywords)
- [Visual & Clips](#visual--clips)
- [Generation & Reels](#generation--reels)
- [Text Styles](#text-styles)
- [Jobs](#jobs)
- [Error Handling](#error-handling)

---

## Health Check

### GET /api/health

Check service health and R2 storage configuration status.

**Response** `200 OK`
```json
{
  "status": "ok",
  "service": "doles-reels-generator",
  "r2_configured": false
}
```

---

## Projects

### POST /api/projects

Create a new project.

**Request Body**
```json
{
  "name": "Tum Hi Ho - Reel"
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-100 chars, auto-trimmed | Project name |

**Response** `201 Created`
```json
{
  "id": "5a214f7c-1234-4567-abcd-123456789abc",
  "name": "Tum Hi Ho - Reel",
  "created_at": "2026-06-12T10:00:00",
  "updated_at": "2026-06-12T10:00:00",
  "status": "draft",
  "vibe_description": null,
  "vibe_keywords": null,
  "language": "hi_dev",
  "visual_mode": null,
  "custom_video_url": null
}
```

**Errors**: `422` if name is empty or exceeds 100 characters.

---

### GET /api/projects

List all projects, newest first.

**Response** `200 OK`
```json
[
  {
    "id": "5a214f7c-...",
    "name": "Tum Hi Ho - Reel",
    "status": "complete",
    "created_at": "2026-06-12T10:00:00",
    ...
  }
]
```

---

### GET /api/projects/{project_id}

Get a single project by UUID.

**Response** `200 OK` - Same schema as create response.

**Errors**: `404` if project not found.

---

### DELETE /api/projects/{project_id}

Delete a project and all associated data (audio, lyrics, clips, reels).

**Response** `204 No Content`

**Errors**: `404` if project not found.

---

## Audio

All audio endpoints are scoped under `/api/projects/{project_id}/audio`.

### POST /api/projects/{project_id}/audio/upload-url

Get a presigned URL for direct-to-R2 audio upload from the browser.

**Request Body**
```json
{
  "filename": "song.mp3",
  "content_type": "audio/mpeg"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | File name with extension |
| `content_type` | string | MIME type of the audio file |

**Supported Formats**: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac`, `.wma`, `.webm`

**Response** `200 OK`
```json
{
  "upload_url": "https://r2-presigned-url...",
  "file_key": "projects/{id}/audio/original_abc123.mp3"
}
```

In mock mode, `upload_url` is a placeholder string.

---

### POST /api/projects/{project_id}/audio/confirm

Confirm that an audio file was uploaded successfully to R2.

**Request Body**
```json
{
  "file_key": "projects/{id}/audio/original_abc123.mp3",
  "duration_seconds": 180.5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `file_key` | string | The R2 file key from upload-url response |
| `duration_seconds` | float | Duration of the audio file in seconds |

**Response** `201 Created`
```json
{
  "id": "uuid...",
  "project_id": "uuid...",
  "original_url": "projects/{id}/audio/original_abc123.mp3",
  "trimmed_url": null,
  "duration_seconds": 180.5,
  "beat_timestamps": null,
  "tempo_bpm": null,
  "created_at": "2026-06-12T10:00:00"
}
```

**Errors**: `400` if file_key doesn't match project, or file not found in R2.

---

### GET /api/projects/{project_id}/audio

Get the audio file metadata for a project.

**Response** `200 OK` - AudioFile schema (same as confirm response).

**Errors**: `404` if no audio file exists.

---

### GET /api/projects/{project_id}/audio/download-url

Get a presigned download URL for the audio file.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `trimmed` | boolean | `false` | If true, return trimmed audio URL |

**Response** `200 OK`
```json
{
  "download_url": "https://presigned-download-url...",
  "file_key": "projects/{id}/audio/original_abc123.mp3"
}
```

---

### POST /api/projects/{project_id}/audio/trim

Extract a 30-second (max) segment from the uploaded audio via FFmpeg.

**Request Body**
```json
{
  "start_sec": 15.0,
  "end_sec": 45.0
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `start_sec` | float | >= 0 | Start of trim in seconds |
| `end_sec` | float | > start_sec, <= duration | End of trim in seconds |

**Constraints**:
- `end_sec - start_sec` must be <= 30.5 seconds (0.5s tolerance)
- `end_sec` must not exceed audio duration + 0.5s tolerance

**Response** `200 OK` - Updated AudioFile with `trimmed_url` set and `duration_seconds` updated to trim length.

**Errors**: `400` for invalid trim range, `500` for FFmpeg failures.

---

### POST /api/projects/{project_id}/audio/transcribe

Start an async transcription job for the project's audio.

**Request Body**
```json
{
  "language": "hi_dev"
}
```

| Field | Type | Options | Description |
|-------|------|---------|-------------|
| `language` | string | `hi_dev`, `hi_rom`, `en` | Transcription language |

**Response** `200 OK`
```json
{
  "job_id": "celery-task-uuid"
}
```

Poll `/api/jobs/{job_id}` for progress. On completion, the lyrics are saved and project status is set to `transcribed`.

---

### POST /api/projects/{project_id}/audio/beats

Run beat detection using Librosa on the project's audio.

**Response** `200 OK`
```json
{
  "beat_timestamps": [0.5, 1.02, 1.55, 2.08, ...],
  "tempo_bpm": 128.5,
  "total_beats": 58
}
```

**Errors**: `404` if no audio file, `500` if beat detection fails.

---

## Lyrics

### GET /api/projects/{project_id}/lyrics

Get lyrics with word-level timing data.

**Response** `200 OK`
```json
{
  "id": "uuid...",
  "project_id": "uuid...",
  "words": [
    {"word": "Tum", "start": 0.5, "end": 0.9, "line_index": 0},
    {"word": "Hi", "start": 0.95, "end": 1.3, "line_index": 0},
    {"word": "Ho", "start": 1.35, "end": 1.8, "line_index": 0}
  ],
  "raw_transcription": "Tum Hi Ho",
  "last_edited_at": "2026-06-12T10:00:00"
}
```

**Errors**: `404` if no lyrics exist (run transcription first).

---

### PUT /api/projects/{project_id}/lyrics

Update word timings or text for the project's lyrics.

**Request Body**
```json
{
  "words": [
    {"word": "Tum", "start": 0.5, "end": 0.9, "line_index": 0},
    {"word": "Hi", "start": 1.0, "end": 1.3, "line_index": 0},
    {"word": "Ho", "start": 1.35, "end": 1.8, "line_index": 1}
  ]
}
```

Each word object requires:

| Field | Type | Description |
|-------|------|-------------|
| `word` | string | The word text |
| `start` | float | Start time in seconds |
| `end` | float | End time in seconds (must be > start) |
| `line_index` | integer | Line group assignment |

**Response** `200 OK` - Updated Lyrics object. `raw_transcription` is rebuilt from words automatically.

**Errors**: `400` if any word has `end <= start`.

---

## Vibe & Keywords

### POST /api/projects/{project_id}/vibe

Set vibe description and auto-extract visual keywords via Claude AI.

**Request Body**
```json
{
  "vibe_description": "Romantic monsoon night in Mumbai, warm streetlights reflecting on wet roads, intimate and emotional"
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `vibe_description` | string | 1-500 chars, auto-trimmed | Free-text vibe description |

**Response** `200 OK`
```json
{
  "vibe_description": "Romantic monsoon night in Mumbai...",
  "keywords": ["monsoon", "mumbai streets", "warm lights", "wet roads", "romantic night"],
  "status": "vibe_set"
}
```

Updates project status to `vibe_set`. If Claude API is unavailable, falls back to basic keyword extraction from the text.

---

### POST /api/projects/{project_id}/vibe/suggest

AI-suggest a vibe description based on audio metadata and lyrics.

**Response** `200 OK`
```json
{
  "suggestion": "Soulful and melancholic Bollywood romance, slow-tempo emotional ballad with intimate confessional lyrics about longing and devotion"
}
```

Uses project tempo (BPM), lyrics text, and language to generate the suggestion. The user can edit before saving.

---

### GET /api/projects/{project_id}/keywords

Get current visual keywords for the project.

**Response** `200 OK`
```json
{
  "keywords": ["monsoon", "mumbai streets", "warm lights", "wet roads", "romantic night"]
}
```

---

### PUT /api/projects/{project_id}/keywords

Update visual keywords manually.

**Request Body**
```json
{
  "keywords": ["monsoon", "city lights", "romance", "rain", "night"]
}
```

| Constraint | Value |
|------------|-------|
| Minimum keywords | 3 |
| Maximum keywords | 10 |

**Errors**: `400` if fewer than 3 keywords after cleaning.

---

## Visual & Clips

### POST /api/projects/{project_id}/visual-mode

Set the visual mode for the project.

**Request Body**
```json
{
  "mode": "stock"
}
```

| Field | Type | Options | Description |
|-------|------|---------|-------------|
| `mode` | string | `stock`, `custom` | Visual source mode |

**Response** `200 OK`
```json
{
  "visual_mode": "stock",
  "custom_video_url": null,
  "status": "vibe_set"
}
```

---

### POST /api/projects/{project_id}/custom-video

Submit a custom video URL (automatically sets visual mode to `custom`).

**Request Body**
```json
{
  "url": "https://example.com/my-video.mp4"
}
```

---

### POST /api/projects/{project_id}/clips/build-pool

Start a Celery task to build the clip pool from Pexels using vibe keywords.

**Prerequisite**: Project must have `vibe_keywords` set.

**Response** `200 OK`
```json
{
  "job_id": "celery-task-uuid",
  "message": "Clip pool build started. Poll job status for progress."
}
```

The task searches Pexels for each keyword, downloads clip metadata, and ranks clips by relevance to the vibe description using Claude AI.

---

### GET /api/projects/{project_id}/clips

Get the clip pool for the project, sorted by relevance score (highest first).

**Response** `200 OK`
```json
{
  "clips": [
    {
      "id": "uuid...",
      "pexels_clip_id": "12345",
      "clip_url": "https://videos.pexels.com/...",
      "duration_seconds": 15.0,
      "width": 1920,
      "height": 1080,
      "relevance_score": 0.92,
      "used": false
    }
  ],
  "total": 8,
  "visual_mode": "stock"
}
```

---

## Generation & Reels

### POST /api/projects/{project_id}/render-single

Queue a single reel render for testing (Phase 11 test endpoint).

**Request Body**
```json
{
  "text_style": 1,
  "clip_pool_id": "optional-uuid"
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `text_style` | integer | 1-6 | Text style number |
| `clip_pool_id` | string? | UUID | Optional specific clip to use |

**Response** `200 OK`
```json
{
  "reel_id": "uuid...",
  "job_id": "celery-task-uuid",
  "text_style": 1,
  "render_status": "queued",
  "message": "Render queued for style 1. Poll /api/jobs/{job_id} for progress."
}
```

---

### POST /api/projects/{project_id}/generate

Generate a full batch of 6 reels (one per text style).

**Prerequisites**: Audio uploaded + trimmed, lyrics transcribed.

**Response** `200 OK`
```json
{
  "batch_number": 1,
  "reel_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5", "uuid6"],
  "job_ids": ["job1", "job2", "job3", "job4", "job5", "job6"],
  "total": 6,
  "message": "Batch 1: 6 reels queued for rendering. Poll /api/projects/{id}/batch-status/1 for progress."
}
```

Sets project status to `generating`. Clips are assigned round-robin from the clip pool (by relevance).

---

### GET /api/projects/{project_id}/batch-status/{batch_number}

Get aggregated status of all reels in a batch. Used by frontend to poll batch progress.

**Response** `200 OK`
```json
{
  "project_id": "uuid...",
  "batch_number": 1,
  "total": 6,
  "queued": 0,
  "rendering": 2,
  "complete": 3,
  "failed": 1,
  "all_complete": false,
  "reels": [
    {
      "reel_id": "uuid...",
      "project_id": "uuid...",
      "text_style": 1,
      "render_status": "complete",
      "output_url": "https://r2-url/reel.mp4",
      "error_message": null,
      "render_started_at": "2026-06-12T10:05:00",
      "render_completed_at": "2026-06-12T10:05:45",
      "batch_number": 1
    }
  ]
}
```

When `all_complete` becomes `true` and at least one reel is `complete`, the project status is automatically set to `complete`.

---

### GET /api/projects/{project_id}/reels

List all generated reels for a project (newest batch first).

**Response** `200 OK`
```json
{
  "project_id": "uuid...",
  "reels": [...],
  "total": 6
}
```

---

### GET /api/projects/{project_id}/reels/{reel_id}

Get single reel details including render status and output URL.

**Errors**: `404` if reel not found or doesn't belong to project.

---

### GET /api/projects/{project_id}/download-zip

Download all completed reels from the latest batch as a zip file.

**Response**: `application/zip` streaming response

| Header | Value |
|--------|-------|
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="Project_Name_reels_batch1.zip"` |

The zip contains MP4 files named: `{ProjectName}_style{N}_reel.mp4`

**Errors**: `404` if no reels exist, `400` if no completed reels, `500` if download fails.

---

## Text Styles

### GET /api/text-styles

List all 6 available text styles.

**Response** `200 OK`
```json
{
  "styles": [
    {"id": 1, "name": "Minimal Fade", "description": "Clean fade-in/out", "category": "minimal"},
    {"id": 2, "name": "Karaoke Highlight", "description": "Sequential word highlighting", "category": "karaoke"},
    {"id": 3, "name": "Word Pop", "description": "Words pop in with scale", "category": "animated"},
    {"id": 4, "name": "Typewriter", "description": "One-by-one typing effect", "category": "animated"},
    {"id": 5, "name": "Stacked Lines", "description": "Lines stack bottom to top", "category": "structured"},
    {"id": 6, "name": "Cinematic Subtitle", "description": "Movie-style bottom subtitles", "category": "cinematic"}
  ],
  "total": 6
}
```

---

### GET /api/text-styles/{style_id}

Get info about a specific text style.

**Errors**: `404` if style not found.

---

### POST /api/text-styles/preview

Generate a preview of the FFmpeg filter string for a style. Useful for debugging.

**Request Body**
```json
{
  "style_number": 1,
  "words": [
    {"word": "Hello", "start": 0.5, "end": 1.0, "line_index": 0}
  ],
  "language": "en",
  "duration": 30.0
}
```

**Response** `200 OK`
```json
{
  "style_number": 1,
  "style_name": "Minimal Fade",
  "filter_string": "drawtext=text='Hello':...",
  "filter_count": 1,
  "language": "en"
}
```

---

## Jobs

### GET /api/jobs/{job_id}

Poll the status of an async Celery task (transcription, clip pool build, render).

**Response** `200 OK`
```json
{
  "job_id": "celery-task-uuid",
  "status": "running",
  "progress": 65,
  "message": "Rendering video with text overlay...",
  "result": null
}
```

| Status | Description |
|--------|-------------|
| `queued` | Task pending, not yet started |
| `running` | Task actively processing |
| `complete` | Task finished successfully |
| `failed` | Task failed with error |

When `status` is `complete`, the `result` field contains task-specific data (e.g., transcription words, reel output URL).

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (new resource) |
| `204` | No Content (successful delete) |
| `400` | Bad Request (validation, business logic) |
| `404` | Not Found (resource doesn't exist) |
| `422` | Validation Error (Pydantic schema) |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "detail": "Human-readable error description"
}
```

Validation errors (422) consolidate multiple field errors into a single semicolon-separated string:
```json
{
  "detail": "name: String should have at least 1 character; other_field: error message"
}
```

### Global Error Handlers

The backend registers three global exception handlers:
1. **RequestValidationError** (422) - Converts Pydantic validation errors to readable messages
2. **SQLAlchemyError** (500) - Catches database errors with safe message
3. **Generic Exception** (500) - Catches all unhandled errors, logs full traceback

### Request Logging

All `/api` requests are logged with method, path, status code, and response time:
```
INFO: GET /api/projects -> 200 (12ms)
INFO: POST /api/projects/uuid/generate -> 200 (45ms)
```
