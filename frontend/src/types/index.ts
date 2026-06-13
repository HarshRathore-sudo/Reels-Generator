// Project types matching backend schemas

export type ProjectStatus = 'draft' | 'transcribed' | 'vibe_set' | 'generating' | 'complete'
export type Language = 'hi_dev' | 'hi_rom' | 'en'
export type VisualMode = 'stock' | 'custom'
export type RenderStatus = 'queued' | 'rendering' | 'complete' | 'failed'
export type JobStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface Project {
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

export interface AudioFile {
  id: string
  project_id: string
  original_url: string
  trimmed_url: string | null
  duration_seconds: number
  beat_timestamps: number[]
  tempo_bpm: number
  created_at: string
}

export interface Word {
  word: string
  start: number
  end: number
  line_index: number
}

export interface Lyrics {
  id: string
  project_id: string
  words: Word[]
  raw_transcription: string
  last_edited_at: string
}

export interface ClipPoolItem {
  id: string
  project_id: string
  pexels_clip_id: string
  clip_url: string
  duration_seconds: number
  width: number
  height: number
  relevance_score: number
  used: boolean
  used_at: string | null
}

export interface GeneratedReel {
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

export interface JobInfo {
  job_id: string
  status: JobStatus
  progress: number
  message: string | null
  result: unknown
}

export interface PresignedUrlResponse {
  upload_url: string
  file_key: string
}

export interface TrimRequest {
  start_sec: number
  end_sec: number
}

export interface VibeResponse {
  suggestion: string
}

export interface KeywordsResponse {
  keywords: string[]
}
