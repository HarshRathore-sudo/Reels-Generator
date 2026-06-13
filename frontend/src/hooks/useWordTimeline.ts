// Hook for managing word-level timeline interactions in the lyrics dashboard
// Implementation in Phase 6

import type { Word } from '../types'

export function useWordTimeline(_words: Word[]) {
  // Stub: will handle drag, snap-to-beat, undo/redo
  return {
    words: [] as Word[],
    selectedWordIndex: null as number | null,
    selectWord: (_index: number) => {},
    moveWord: (_index: number, _newStart: number, _newEnd: number) => {},
    undo: () => {},
    redo: () => {},
    canUndo: false,
    canRedo: false,
  }
}
