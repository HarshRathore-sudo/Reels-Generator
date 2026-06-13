# Frontend Guide

Component architecture, state management, and UI patterns for the Doles Reels Generator frontend.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Routing](#routing)
- [State Management](#state-management)
- [API Layer](#api-layer)
- [Component Hierarchy](#component-hierarchy)
- [Page Components](#page-components)
- [Domain Components](#domain-components)
- [Shared Components](#shared-components)
- [Custom Hooks](#custom-hooks)
- [TypeScript Types](#typescript-types)
- [Styling Patterns](#styling-patterns)
- [Error Handling](#error-handling)

---

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18 | UI framework |
| Vite | latest | Build tool + dev server with HMR |
| TypeScript | strict mode | Type safety |
| Tailwind CSS | v4 | Utility-first CSS via `@tailwindcss/vite` plugin |
| Zustand | latest | Lightweight state management |
| React Router | v6 | Client-side routing |
| Axios | latest | HTTP client with interceptors |
| WaveSurfer.js | v7 | Audio waveform visualization |

### TypeScript Configuration

The project uses strict TypeScript settings:
- `verbatimModuleSyntax: true` - Requires explicit `type` keyword for type imports
- `noUnusedLocals: true` - Errors on unused variables
- `noUnusedParameters: true` - Errors on unused function parameters

---

## Architecture Overview

```
App.tsx (ErrorBoundary + Router + ToastContainer)
│
├── ProjectListPage          /
├── NewProjectPage           /projects/new
├── ProjectDetailPage        /projects/:id
├── ProjectFlowPage          /projects/:id/flow
│   ├── Step 1: AudioUploader
│   ├── Step 2: AudioTrimmer
│   ├── Step 3: TranscriptionProgress
│   ├── Step 4: LyricsReviewDashboard
│   ├── Step 5: VibeInput + KeywordEditor
│   ├── Step 6: VisualModeSelector + ClipPoolGallery
│   └── Step 7: GenerateStep (ProgressView | ReelGrid)
└── NotFoundPage             *
```

---

## Routing

Defined in `App.tsx`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `ProjectListPage` | Dashboard with project list |
| `/projects/new` | `NewProjectPage` | Create new project form |
| `/projects/:id` | `ProjectDetailPage` | Project details view |
| `/projects/:id/flow` | `ProjectFlowPage` | Multi-step workflow wizard |
| `*` | `NotFoundPage` | 404 fallback |

**Key distinction**: `/projects/:id` shows the project detail view, while `/projects/:id/flow` is the main interactive wizard where users progress through steps.

---

## State Management

### Project Store (`store/projectStore.ts`)

Zustand store managing the active project's data.

```typescript
interface ProjectStore {
  // Data
  project: Project | null
  audioFile: AudioFile | null
  lyrics: Lyrics | null
  clips: ClipPoolItem[]

  // Loading states
  isLoading: boolean
  error: string | null

  // Actions
  loadProject: (id: string) => Promise<void>
  setProject: (project: Project) => void
  setAudioFile: (audio: AudioFile) => void
  setLyrics: (lyrics: Lyrics) => void
  setClips: (clips: ClipPoolItem[]) => void
  clearProject: () => void
}
```

### Toast Store (`store/toastStore.ts`)

Global toast notification system.

```typescript
interface ToastState {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  clearAll: () => void
}
```

**Convenience functions** (usable outside React components):
```typescript
import { toast } from '../store/toastStore'

toast.success('Project created!')
toast.error('Upload failed', 6000)     // 6s duration
toast.info('Processing...')
toast.warning('Low quality audio')
```

**Behavior**:
- Max 5 stacked toasts (oldest removed first)
- Auto-dismiss: success/info 4s, warning 5s, error 6s
- Accessible via `useToastStore` hook or `toast.*` functions

---

## API Layer

### API Client (`api/apiClient.ts`)

Axios instance with global configuration:

```typescript
const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,   // 30 second timeout
})
```

**Retry Logic**: GET requests automatically retry up to 2 times on transient errors (502, 503, 504, 408) with 1-second incremental delay.

**Error Toast**: Auto-shows toast for 500+ errors and timeouts. Can be suppressed with `_skipToast: true` in config.

### API Modules

Each domain has a dedicated API module:

| Module | Endpoints |
|--------|-----------|
| `projectsApi.ts` | CRUD operations on projects |
| `audioApi.ts` | Upload URL, confirm, trim, transcribe, beats, download |
| `lyricsApi.ts` | Get and update lyrics |
| `vibeApi.ts` | Set vibe, suggest vibe, get/update keywords |
| `visualApi.ts` | Visual mode, custom video, build pool, get clips |
| `textStylesApi.ts` | List and get text styles |
| `generationApi.ts` | Generate batch, batch status, list reels, download zip |

All modules import the shared `apiClient` instance.

---

## Component Hierarchy

### Full Component Tree

```
App.tsx
├── ErrorBoundary (class component)
│   └── Router
│       ├── ProjectListPage
│       │   ├── ProjectCard (per project)
│       │   └── Modal (delete confirmation)
│       │
│       ├── NewProjectPage
│       │   └── Button
│       │
│       ├── ProjectDetailPage
│       │
│       ├── ProjectFlowPage
│       │   ├── Step Indicator (horizontal scroll)
│       │   │
│       │   ├── AudioUploader
│       │   │   └── WaveformPreview
│       │   │
│       │   ├── AudioTrimmer
│       │   │   └── WaveSurfer (with Regions plugin)
│       │   │
│       │   ├── TranscriptionProgress
│       │   │   └── Progress bar + status polling
│       │   │
│       │   ├── LyricsReviewDashboard
│       │   │   ├── LyricsListPanel
│       │   │   ├── WordTimeline
│       │   │   ├── BlackPreview (live preview)
│       │   │   └── TextStylePicker
│       │   │
│       │   ├── VibeInput
│       │   │   └── KeywordEditor
│       │   │
│       │   ├── VisualModeSelector
│       │   │   ├── ClipPoolGallery
│       │   │   └── CustomVideoInput
│       │   │
│       │   └── GenerateStep
│       │       ├── ProgressView (during generation)
│       │       │   └── ReelCard (per reel, mini status)
│       │       └── ReelGrid (after completion)
│       │           └── ReelCard (per reel, full preview)
│       │
│       └── NotFoundPage
│
└── ToastContainer
    └── Toast (per active toast)
```

---

## Page Components

### ProjectListPage

**Path**: `/`

Dashboard showing all projects as cards.

**Features**:
- Loading skeleton (3 animated rows during load)
- Project cards with status badge, creation date, and actions
- Delete with Modal confirmation (shows project name)
- Navigate to project flow on click
- Status labels: Draft, Transcribed, Vibe Set, Generating, Complete
- Responsive: `flex-col sm:flex-row` layouts

### NewProjectPage

**Path**: `/projects/new`

**Features**:
- Project name input with `MAX_NAME_LENGTH = 100`
- Character counter (`0/100`) with color thresholds:
  - Default: `text-slate-500`
  - Warning (>80): `text-amber-400`
  - Limit (100): `text-red-400`
- Create button disabled when empty
- Toast on successful creation
- Auto-redirect to flow page on success

### ProjectFlowPage

**Path**: `/projects/:id/flow`

The main multi-step wizard. This is where users spend most of their time.

**Features**:
- 7-step horizontal indicator with active/completed states
- Step-based content rendering (one step visible at a time)
- Loading skeleton during project load
- Step auto-determination based on project status
- Responsive step indicator with horizontal scroll on mobile
- Toast notifications on step transitions

**Step Mapping**:

| Step | Component | Condition to Show |
|------|-----------|-------------------|
| 1 | AudioUploader | Always (if no audio) |
| 2 | AudioTrimmer | Audio uploaded, not trimmed |
| 3 | TranscriptionProgress | Audio trimmed, not transcribed |
| 4 | LyricsReviewDashboard | Status >= transcribed |
| 5 | VibeInput + KeywordEditor | Status >= transcribed |
| 6 | VisualModeSelector | Status >= vibe_set |
| 7 | GenerateStep | Status >= vibe_set |

### ProjectDetailPage

**Path**: `/projects/:id`

Read-only project details view. Not the main workflow page.

### NotFoundPage

**Path**: `*`

Shows "404 - Page not found" with a "Go Home" link.

---

## Domain Components

### Audio Components (`components/audio/`)

#### AudioUploader
- File input for audio upload (drag & drop)
- Calls `upload-url` -> direct R2 upload -> `confirm`
- Uses `useAudioUpload` hook for upload logic
- Shows upload progress

#### AudioTrimmer
- WaveSurfer.js v7 with Regions plugin
- Interactive region selection for trim boundaries
- Enforces 30-second max trim duration
- Play/pause controls for preview
- Calls `POST /audio/trim` on confirm

#### WaveformPreview
- Read-only waveform display
- Used in the upload step for audio preview

#### TranscriptionProgress
- Polls `/api/jobs/{job_id}` every 2 seconds
- Progress bar with percentage and status message
- Transitions to next step on completion

### Lyrics Components (`components/lyrics/`)

#### LyricsReviewDashboard
- Main container for lyrics editing
- Three-panel layout: list, timeline, preview

#### LyricsListPanel
- Scrollable list of words with timing
- Edit word text, start/end times
- Add/remove words

#### WordTimeline
- Visual timeline with word blocks
- Drag to adjust timing
- Uses `useWordTimeline` hook

#### BlackPreview
- Live preview of text rendering
- Simulates how lyrics will appear on the reel

#### TextStylePicker
- Grid of 6 text style options
- Visual preview of each style

### Vibe Components (`components/vibe/`)

#### VibeInput
- Textarea with `MAX_VIBE_LENGTH = 500`
- Character counter with color thresholds
- "AI Suggest" button (calls `/vibe/suggest`)
- Submit button (calls `POST /vibe`)

#### KeywordEditor
- Editable keyword chips/tags
- Add/remove keywords
- Min 3, max 10 constraint
- Calls `PUT /keywords` on save

### Visual Components (`components/visual/`)

#### VisualModeSelector
- Toggle between Stock and Custom modes
- Shows appropriate sub-component

#### ClipPoolGallery
- Grid of video clip thumbnails
- Shows relevance score
- "Build Pool" button to trigger Pexels search
- Progress polling during pool build

#### CustomVideoInput
- URL input for custom video
- Calls `POST /custom-video`

### Generation Components (`components/generation/`)

#### GenerateStep
- Three-phase UI state machine:
  1. **Ready**: "Generate Reels" button
  2. **Generating**: Shows `ProgressView`
  3. **Complete**: Shows `ReelGrid`
- Checks for existing reels on mount
- Manages batch generation lifecycle

#### ProgressView
- Real-time batch progress tracking
- Polls `/batch-status/{batch}` every 2 seconds
- Per-reel status cards (queued/rendering/complete/failed)
- Poll error recovery after 10 consecutive failures
- "Resume polling" button on error
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

#### ReelGrid
- Grid display of completed reels
- "Regenerate All" and "Download All" buttons
- Download zip calls `GET /download-zip`
- Toast notifications for download status

#### ReelCard
- Individual reel card with video preview
- Shows style name, render status, timing
- Download individual reel link

---

## Shared Components

### Button (`components/shared/Button.tsx`)
Reusable button with variants (primary, secondary, danger) and loading state.

### Modal (`components/shared/Modal.tsx`)
Centered modal overlay with title, content, and action buttons. Used for delete confirmation.

### Toast (`components/shared/Toast.tsx`)
**ToastContainer** renders stacked toasts from `useToastStore`. Each toast has:
- Type-specific styling (green/red/amber/blue)
- Slide-in animation
- Dismiss button
- Auto-dismiss timer

### ErrorBoundary (`components/shared/ErrorBoundary.tsx`)
React class-based Error Boundary. Catches unhandled component errors.

**Fallback UI includes**:
- Error message display
- Collapsible error details
- "Try Again" button (resets error state)
- "Go Home" button (navigates to `/`)

### ProjectCard (`components/shared/ProjectCard.tsx`)
Card component for the project list, showing name, status badge, and creation date.

---

## Custom Hooks

### useProject (`hooks/useProject.ts`)
Loads a project by ID and populates the project store.

```typescript
const { project, isLoading, error } = useProject(projectId)
```

### useAudioUpload (`hooks/useAudioUpload.ts`)
Manages the audio upload flow (get URL, upload, confirm).

```typescript
const { upload, isUploading, progress, error } = useAudioUpload(projectId)
```

### useWordTimeline (`hooks/useWordTimeline.ts`)
Manages word timeline interactions (drag, resize, selection).

---

## TypeScript Types

All shared types are defined in `types/index.ts`:

### Enums (string unions)
```typescript
type ProjectStatus = 'draft' | 'transcribed' | 'vibe_set' | 'generating' | 'complete'
type Language = 'hi_dev' | 'hi_rom' | 'en'
type VisualMode = 'stock' | 'custom'
type RenderStatus = 'queued' | 'rendering' | 'complete' | 'failed'
type JobStatus = 'queued' | 'running' | 'complete' | 'failed'
```

### Main Interfaces
```typescript
interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
  status: ProjectStatus
  vibe_description: string | null
  vibe_keywords: string[] | null
  language: Language
  visual_mode: VisualMode | null
  custom_video_url: string | null
}

interface AudioFile {
  id: string
  project_id: string
  original_url: string
  trimmed_url: string | null
  duration_seconds: number
  beat_timestamps: number[]
  tempo_bpm: number
  created_at: string
}

interface Word {
  word: string
  start: number
  end: number
  line_index: number
}

interface Lyrics {
  id: string
  project_id: string
  words: Word[]
  raw_transcription: string
  last_edited_at: string
}

interface GeneratedReel {
  id: string
  project_id: string
  batch_number: number
  text_style: number
  clip_pool_id: string | null
  output_url: string
  render_status: RenderStatus
  render_started_at: string | null
  render_completed_at: string | null
  error_message: string | null
}
```

---

## Styling Patterns

### Tailwind CSS v4

The project uses Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`). No `tailwind.config.js` needed.

### Color Palette

| Usage | Colors |
|-------|--------|
| Background | `bg-slate-900`, `bg-slate-800` |
| Text | `text-slate-200`, `text-slate-400` |
| Primary accent | `bg-indigo-600`, `hover:bg-indigo-500` |
| Success | `bg-emerald-500/20`, `text-emerald-400` |
| Error | `bg-red-500/20`, `text-red-400` |
| Warning | `bg-amber-500/20`, `text-amber-400` |

### Responsive Breakpoints

Mobile-first design with breakpoints:
- Default: mobile
- `sm:` (640px): tablet
- `md:` (768px): small desktop
- `lg:` (1024px): desktop

Common patterns:
```css
/* Stack on mobile, row on tablet */
flex flex-col sm:flex-row

/* 1 column mobile, 2 tablet, 3 desktop */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

/* Smaller padding on mobile */
px-4 sm:px-6

/* Full width buttons on mobile */
flex-1 sm:flex-none
```

### Loading Skeletons

Animated pulse skeletons match content layout:
```tsx
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
</div>
```

### Custom Animations

Defined in `index.css`:
- `@keyframes toast-in` - Slide-in from right for toasts
- `.scrollbar-none` - Hides scrollbar on step indicator

---

## Error Handling

### Layers of Protection

1. **Axios Interceptor** (API level)
   - Retries GET requests on transient errors
   - Shows error toasts for server errors
   - Extracts human-readable error messages

2. **Component-level try/catch**
   - API calls wrapped in try/catch
   - Error state displayed inline
   - Toast for user-facing errors

3. **Error Boundary** (App level)
   - Catches unhandled React errors
   - Shows fallback UI with retry option
   - Prevents white screen of death

4. **Toast Notifications** (Global)
   - Success/error/warning/info feedback
   - Stacked display, auto-dismiss
   - Available inside and outside React

5. **Poll Error Recovery** (ProgressView)
   - Tracks consecutive poll failures
   - Stops after 10 failures
   - "Resume polling" button to restart
