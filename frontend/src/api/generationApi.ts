import { apiClient } from './apiClient'
import type { GeneratedReel } from '../types'

// ── Response types matching backend schemas ────────────────────

export interface GenerateBatchResponse {
  batch_number: number
  reel_ids: string[]
  job_ids: string[]
  total: number
  message: string
}

export interface ReelListResponse {
  project_id: string
  reels: ReelStatusItem[]
  total: number
}

export interface ReelStatusItem {
  reel_id: string
  project_id: string
  text_style: number
  render_status: string
  output_url: string | null
  error_message: string | null
  render_started_at: string | null
  render_completed_at: string | null
  batch_number: number
}

export interface BatchStatusResponse {
  project_id: string
  batch_number: number
  total: number
  queued: number
  rendering: number
  complete: number
  failed: number
  all_complete: boolean
  reels: ReelStatusItem[]
}

// ── API functions ──────────────────────────────────────────────

/**
 * Queue full batch generation of 6 reels (one per text style).
 */
export async function generateReels(projectId: string): Promise<GenerateBatchResponse> {
  const response = await apiClient.post<GenerateBatchResponse>(`/projects/${projectId}/generate`)
  return response.data
}

/**
 * Get aggregated batch status with all reel statuses.
 */
export async function getBatchStatus(projectId: string, batchNumber: number): Promise<BatchStatusResponse> {
  const response = await apiClient.get<BatchStatusResponse>(`/projects/${projectId}/batch-status/${batchNumber}`)
  return response.data
}

/**
 * List all generated reels for a project.
 */
export async function listReels(projectId: string): Promise<ReelListResponse> {
  const response = await apiClient.get<ReelListResponse>(`/projects/${projectId}/reels`)
  return response.data
}

/**
 * Get a single reel by ID.
 */
export async function getReel(projectId: string, reelId: string): Promise<GeneratedReel> {
  const response = await apiClient.get<GeneratedReel>(`/projects/${projectId}/reels/${reelId}`)
  return response.data
}

/**
 * Download all reels as a zip file. Returns the download URL.
 */
export function getDownloadZipUrl(projectId: string): string {
  return `/api/projects/${projectId}/download-zip`
}

/**
 * Poll a Celery job for progress.
 */
export async function getJobStatus(jobId: string): Promise<{
  job_id: string
  status: string
  progress: number
  message: string
  result: unknown
}> {
  const response = await apiClient.get(`/jobs/${jobId}`)
  return response.data
}
