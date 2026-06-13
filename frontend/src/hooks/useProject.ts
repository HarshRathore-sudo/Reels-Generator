import { useEffect, useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { getProject } from '../api/projectsApi'
import { getAudio } from '../api/audioApi'

/**
 * Hook for fetching and managing project-level data.
 * Loads project + audio file metadata when projectId changes.
 */
export function useProject(projectId: string) {
  const {
    currentProject,
    audioFile,
    lyrics,
    reels,
    isLoading,
    error,
    setCurrentProject,
    setAudioFile,
    setLoading,
    setError,
  } = useProjectStore()

  const fetchProject = useCallback(async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch project data
      const project = await getProject(projectId)
      setCurrentProject(project)

      // Try to fetch audio file (may not exist yet)
      try {
        const audio = await getAudio(projectId)
        setAudioFile(audio)
      } catch {
        // Audio not yet uploaded - that's OK
        setAudioFile(null)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      const apiMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(apiMessage || message)
    } finally {
      setLoading(false)
    }
  }, [projectId, setCurrentProject, setAudioFile, setLoading, setError])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  return {
    project: currentProject,
    audioFile,
    lyrics,
    reels,
    isLoading,
    error,
    refetch: fetchProject,
  }
}
