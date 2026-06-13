import { apiClient } from './apiClient'
import type { Project } from '../types'

export async function createProject(name: string): Promise<Project> {
  const response = await apiClient.post<Project>('/projects', { name })
  return response.data
}

export async function listProjects(): Promise<Project[]> {
  const response = await apiClient.get<Project[]>('/projects')
  return response.data
}

export async function getProject(id: string): Promise<Project> {
  const response = await apiClient.get<Project>(`/projects/${id}`)
  return response.data
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`)
}
