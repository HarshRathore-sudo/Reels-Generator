import { apiClient } from './apiClient'

export interface TextStyleInfo {
  id: number
  name: string
  description: string
  category: string
}

export interface TextStyleListResponse {
  styles: TextStyleInfo[]
  total: number
}

export interface PreviewResponse {
  style_number: number
  style_name: string
  filter_string: string
  filter_count: number
  language: string
}

/**
 * Get all available text styles.
 */
export async function listTextStyles(): Promise<TextStyleListResponse> {
  const response = await apiClient.get<TextStyleListResponse>('/text-styles')
  return response.data
}

/**
 * Get info about a specific text style.
 */
export async function getTextStyle(styleId: number): Promise<TextStyleInfo> {
  const response = await apiClient.get<TextStyleInfo>(`/text-styles/${styleId}`)
  return response.data
}

/**
 * Preview the FFmpeg filter output for a style with given words.
 */
export async function previewTextStyle(
  styleNumber: number,
  words: { word: string; start: number; end: number; line_index: number }[],
  language: string = 'en',
  duration: number = 30.0,
): Promise<PreviewResponse> {
  const response = await apiClient.post<PreviewResponse>('/text-styles/preview', {
    style_number: styleNumber,
    words,
    language,
    duration,
  })
  return response.data
}
