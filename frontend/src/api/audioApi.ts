import { apiClient } from './apiClient'
import type { AudioFile, PresignedUrlResponse, TrimRequest, JobInfo } from '../types'

export async function getUploadUrl(projectId: string, filename: string): Promise<PresignedUrlResponse> {
  const response = await apiClient.post<PresignedUrlResponse>(
    `/projects/${projectId}/audio/upload-url`,
    { filename }
  )
  return response.data
}

export async function confirmUpload(projectId: string, fileKey: string, durationSeconds: number): Promise<AudioFile> {
  const response = await apiClient.post<AudioFile>(
    `/projects/${projectId}/audio/confirm`,
    { file_key: fileKey, duration_seconds: durationSeconds }
  )
  return response.data
}

export async function getAudio(projectId: string): Promise<AudioFile> {
  const response = await apiClient.get<AudioFile>(
    `/projects/${projectId}/audio`
  )
  return response.data
}

export async function getAudioDownloadUrl(
  projectId: string,
  trimmed: boolean = false,
): Promise<{ download_url: string; file_key: string }> {
  const response = await apiClient.get<{ download_url: string; file_key: string }>(
    `/projects/${projectId}/audio/download-url`,
    { params: { trimmed } }
  )
  return response.data
}

export async function trimAudio(projectId: string, trim: TrimRequest): Promise<AudioFile> {
  const response = await apiClient.post<AudioFile>(
    `/projects/${projectId}/audio/trim`,
    trim
  )
  return response.data
}

export async function startTranscription(projectId: string, language: string): Promise<{ job_id: string }> {
  const response = await apiClient.post<{ job_id: string }>(
    `/projects/${projectId}/audio/transcribe`,
    { language }
  )
  return response.data
}

export async function getJobStatus(jobId: string): Promise<JobInfo> {
  const response = await apiClient.get<JobInfo>(`/jobs/${jobId}`)
  return response.data
}

export interface BeatDetectionResult {
  beat_timestamps: number[]
  tempo_bpm: number
  total_beats: number
}

export async function detectBeats(projectId: string): Promise<BeatDetectionResult> {
  const response = await apiClient.post<BeatDetectionResult>(
    `/projects/${projectId}/audio/beats`
  )
  return response.data
}
