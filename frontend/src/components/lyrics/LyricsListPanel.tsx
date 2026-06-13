import { useState, useCallback, useRef, useEffect } from 'react'
import type { Word } from '../../types'

interface LyricsListPanelProps {
  words: Word[]
  currentTime: number
  onWordUpdate: (index: number, updates: Partial<Word>) => void
  onWordDelete: (index: number) => void
  onWordAdd: (afterIndex: number) => void
  onSeek: (time: number) => void
  selectedWordIndex: number | null
  onSelectWord: (index: number | null) => void
}

interface LineGroup {
  lineIndex: number
  words: { word: Word; globalIndex: number }[]
}

function groupByLine(words: Word[]): LineGroup[] {
  const map = new Map<number, { word: Word; globalIndex: number }[]>()
  words.forEach((w, i) => {
    const existing = map.get(w.line_index) || []
    existing.push({ word: w, globalIndex: i })
    map.set(w.line_index, existing)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([lineIndex, lineWords]) => ({ lineIndex, words: lineWords }))
}

export function LyricsListPanel({
  words,
  currentTime,
  onWordUpdate,
  onWordDelete,
  onWordAdd,
  onSeek,
  selectedWordIndex,
  onSelectWord,
}: LyricsListPanelProps) {
  const [editingWord, setEditingWord] = useState<number | null>(null)
  const [editingTiming, setEditingTiming] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)

  const lines = groupByLine(words)

  // Find currently active line based on playback time
  const activeLine = lines.find(line =>
    line.words.some(w => currentTime >= w.word.start && currentTime <= w.word.end)
  )

  // Auto-scroll to active line during playback
  useEffect(() => {
    if (activeLineRef.current && scrollRef.current) {
      const container = scrollRef.current
      const element = activeLineRef.current
      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()

      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeLine?.lineIndex])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Lyrics
        </h3>
        <span className="text-xs text-slate-500">
          {words.length} words / {lines.length} lines
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {lines.map((line) => {
          const isActiveLine = activeLine?.lineIndex === line.lineIndex
          const lineStart = Math.min(...line.words.map(w => w.word.start))

          return (
            <div
              key={line.lineIndex}
              ref={isActiveLine ? activeLineRef : undefined}
              className={`
                rounded-xl border transition-all duration-200
                ${isActiveLine
                  ? 'border-purple-500/40 bg-purple-500/5'
                  : 'border-slate-700/30 bg-slate-800/20 hover:bg-slate-800/40'
                }
              `}
            >
              {/* Line header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/20">
                <button
                  onClick={() => onSeek(lineStart)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                  </svg>
                  Line {line.lineIndex + 1}
                </button>
                <span className="text-[10px] font-mono text-slate-600">
                  {formatTime(lineStart)}
                </span>
              </div>

              {/* Words */}
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {line.words.map(({ word, globalIndex }) => {
                  const isActive = currentTime >= word.start && currentTime <= word.end
                  const isSelected = selectedWordIndex === globalIndex
                  const isEditing = editingWord === globalIndex
                  const isEditingTime = editingTiming === globalIndex

                  return (
                    <WordChip
                      key={globalIndex}
                      word={word}
                      globalIndex={globalIndex}
                      isActive={isActive}
                      isSelected={isSelected}
                      isEditing={isEditing}
                      isEditingTime={isEditingTime}
                      onSelect={() => {
                        onSelectWord(isSelected ? null : globalIndex)
                        onSeek(word.start)
                      }}
                      onStartEdit={() => setEditingWord(globalIndex)}
                      onEndEdit={(newText) => {
                        if (newText.trim()) {
                          onWordUpdate(globalIndex, { word: newText.trim() })
                        }
                        setEditingWord(null)
                      }}
                      onStartTimingEdit={() => setEditingTiming(globalIndex)}
                      onEndTimingEdit={(start, end) => {
                        onWordUpdate(globalIndex, { start, end })
                        setEditingTiming(null)
                      }}
                      onCancelTimingEdit={() => setEditingTiming(null)}
                      onDelete={() => onWordDelete(globalIndex)}
                      onAddAfter={() => onWordAdd(globalIndex)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Word Chip ───────────────────────────────────────────────────

interface WordChipProps {
  word: Word
  globalIndex: number
  isActive: boolean
  isSelected: boolean
  isEditing: boolean
  isEditingTime: boolean
  onSelect: () => void
  onStartEdit: () => void
  onEndEdit: (text: string) => void
  onStartTimingEdit: () => void
  onEndTimingEdit: (start: number, end: number) => void
  onCancelTimingEdit: () => void
  onDelete: () => void
  onAddAfter: () => void
}

function WordChip({
  word,
  isActive,
  isSelected,
  isEditing,
  isEditingTime,
  onSelect,
  onStartEdit,
  onEndEdit,
  onStartTimingEdit,
  onEndTimingEdit,
  onCancelTimingEdit,
  onDelete,
  onAddAfter,
}: WordChipProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editText, setEditText] = useState(word.word)
  const [editStart, setEditStart] = useState(word.start.toFixed(3))
  const [editEnd, setEditEnd] = useState(word.end.toFixed(3))

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditText(word.word)
    setEditStart(word.start.toFixed(3))
    setEditEnd(word.end.toFixed(3))
  }, [word.word, word.start, word.end])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEndEdit(editText)
    } else if (e.key === 'Escape') {
      setEditText(word.word)
      onEndEdit(word.word)
    }
  }, [editText, word.word, onEndEdit])

  const handleTimingSave = useCallback(() => {
    const s = parseFloat(editStart)
    const e = parseFloat(editEnd)
    if (!isNaN(s) && !isNaN(e) && s >= 0 && e > s) {
      onEndTimingEdit(s, e)
    } else {
      onCancelTimingEdit()
    }
  }, [editStart, editEnd, onEndTimingEdit, onCancelTimingEdit])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onEndEdit(editText)}
        className="px-2 py-0.5 text-sm bg-slate-700 text-white rounded-lg border border-purple-500 outline-none min-w-[3rem] max-w-[10rem]"
        style={{ width: `${Math.max(editText.length * 0.6 + 1.5, 3)}rem` }}
      />
    )
  }

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onStartEdit()
        }}
        className={`
          inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-medium
          transition-all duration-150 cursor-pointer
          ${isActive
            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 scale-105'
            : isSelected
              ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/50'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
          }
        `}
      >
        {word.word}
      </button>

      {/* Selected word actions */}
      {isSelected && !isEditingTime && (
        <div className="absolute left-0 top-full mt-1 z-20 flex flex-col gap-1 min-w-[140px]">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 space-y-1">
            {/* Timing display */}
            <button
              onClick={onStartTimingEdit}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {word.start.toFixed(2)}s - {word.end.toFixed(2)}s
            </button>

            {/* Edit text */}
            <button
              onClick={onStartEdit}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
              Edit text
            </button>

            {/* Add word after */}
            <button
              onClick={onAddAfter}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add word after
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete word
            </button>
          </div>
        </div>
      )}

      {/* Timing editor popover */}
      {isSelected && isEditingTime && (
        <div className="absolute left-0 top-full mt-1 z-20">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 space-y-2 min-w-[180px]">
            <div className="text-xs font-medium text-slate-300 mb-1">Edit Timing</div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-8">Start</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-slate-700 text-white rounded border border-slate-600 outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500">s</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-8">End</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-slate-700 text-white rounded border border-slate-600 outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500">s</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={handleTimingSave}
                className="flex-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={onCancelTimingEdit}
                className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 100)
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
