import { apiClient } from './apiClient'
import type { Lyrics, Word } from '../types'

export async function getLyrics(projectId: string): Promise<Lyrics> {
  const response = await apiClient.get<Lyrics>(`/projects/${projectId}/lyrics`)
  return response.data
}

export async function updateLyrics(projectId: string, words: Word[]): Promise<Lyrics> {
  const response = await apiClient.put<Lyrics>(
    `/projects/${projectId}/lyrics`,
    { words }
  )
  return response.data
}
