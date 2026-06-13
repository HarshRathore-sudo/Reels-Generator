import { apiClient } from './apiClient'

// ── Request / Response types ─────────────────────────────────────

export interface VibeRequest {
  vibe_description: string
}

export interface VibeResponse {
  vibe_description: string
  keywords: string[]
  status: string
}

export interface VibeSuggestResponse {
  suggestion: string
}

export interface KeywordsResponse {
  keywords: string[]
}

export interface KeywordsUpdateRequest {
  keywords: string[]
}

// ── API functions ────────────────────────────────────────────────

/**
 * Set the vibe description for a project.
 * Also auto-extracts visual keywords via Claude.
 * Updates project status to 'vibe_set'.
 */
export async function setVibe(
  projectId: string,
  vibeDescription: string,
): Promise<VibeResponse> {
  const response = await apiClient.post<VibeResponse>(
    `/projects/${projectId}/vibe`,
    { vibe_description: vibeDescription },
  )
  return response.data
}

/**
 * Get an AI-suggested vibe based on lyrics + audio metadata.
 * Does NOT save anything — returns a suggestion the user can edit.
 */
export async function suggestVibe(
  projectId: string,
): Promise<VibeSuggestResponse> {
  const response = await apiClient.post<VibeSuggestResponse>(
    `/projects/${projectId}/vibe/suggest`,
  )
  return response.data
}

/**
 * Get the current visual keywords for a project.
 */
export async function getKeywords(
  projectId: string,
): Promise<KeywordsResponse> {
  const response = await apiClient.get<KeywordsResponse>(
    `/projects/${projectId}/keywords`,
  )
  return response.data
}

/**
 * Update keywords manually (min 3, max 10).
 */
export async function updateKeywords(
  projectId: string,
  keywords: string[],
): Promise<KeywordsResponse> {
  const response = await apiClient.put<KeywordsResponse>(
    `/projects/${projectId}/keywords`,
    { keywords },
  )
  return response.data
}
