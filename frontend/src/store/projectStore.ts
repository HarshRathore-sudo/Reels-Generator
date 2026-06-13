import { create } from 'zustand'
import type { Project, AudioFile, Lyrics, GeneratedReel } from '../types'

interface ProjectState {
  // Current project data
  currentProject: Project | null
  audioFile: AudioFile | null
  lyrics: Lyrics | null
  reels: GeneratedReel[]
  projects: Project[]

  // Loading states
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentProject: (project: Project | null) => void
  setAudioFile: (audio: AudioFile | null) => void
  setLyrics: (lyrics: Lyrics | null) => void
  setReels: (reels: GeneratedReel[]) => void
  setProjects: (projects: Project[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  currentProject: null,
  audioFile: null,
  lyrics: null,
  reels: [],
  projects: [],
  isLoading: false,
  error: null,
}

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  setCurrentProject: (project) => set({ currentProject: project }),
  setAudioFile: (audio) => set({ audioFile: audio }),
  setLyrics: (lyrics) => set({ lyrics }),
  setReels: (reels) => set({ reels }),
  setProjects: (projects) => set({ projects }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}))
