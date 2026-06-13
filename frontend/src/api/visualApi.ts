import { apiClient } from './apiClient'
import type { ClipPoolItem } from '../types'

// ── Request / Response types ─────────────────────────────────────

export interface VisualModeResponse {
  visual_mode: string
  custom_video_url: string | null
  status: string
}

export interface BuildPoolResponse {
  job_id: string
  message: string
}

export interface ClipPoolResponse {
  clips: ClipPoolItem[]
  total: number
  visual_mode: string | null
}

export interface JobStatusResponse {
  job_id: string
  status: string
  progress: number
  message: string | null
  result: Record<string, unknown> | null
}

// ── API functions ────────────────────────────────────────────────

/**
 * Set the visual mode for a project ('stock' or 'custom').
 */
export async function setVisualMode(
  projectId: string,
  mode: 'stock' | 'custom',
): Promise<VisualModeResponse> {
  const response = await apiClient.post<VisualModeResponse>(
    `/projects/${projectId}/visual-mode`,
    { mode },
  )
  return response.data
}

/**
 * Submit a custom video URL. Sets visual mode to 'custom' automatically.
 */
export async function submitCustomVideo(
  projectId: string,
  url: string,
): Promise<VisualModeResponse> {
  const response = await apiClient.post<VisualModeResponse>(
    `/projects/${projectId}/custom-video`,
    { url },
  )
  return response.data
}

/**
 * Start a Celery job to build the clip pool from Pexels.
 * Returns a job_id that can be polled for progress.
 */
export async function buildClipPool(
  projectId: string,
): Promise<BuildPoolResponse> {
  const response = await apiClient.post<BuildPoolResponse>(
    `/projects/${projectId}/clips/build-pool`,
  )
  return response.data
}

/**
 * Get the clip pool for a project.
 * Returns clips sorted by relevance (highest first).
 */
export async function getClipPool(
  projectId: string,
): Promise<ClipPoolResponse> {
  const response = await apiClient.get<ClipPoolResponse>(
    `/projects/${projectId}/clips`,
  )
  return response.data
}

/**
 * Get the status of an async job (Celery task).
 */
export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResponse> {
  const response = await apiClient.get<JobStatusResponse>(
    `/jobs/${jobId}`,
  )
  return response.data
}
