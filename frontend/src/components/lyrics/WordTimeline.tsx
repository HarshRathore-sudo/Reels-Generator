import { useRef, useCallback, useState, useEffect } from 'react'
import type { Word } from '../../types'

interface WordTimelineProps {
  words: Word[]
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  onWordUpdate: (index: number, updates: Partial<Word>) => void
  selectedWordIndex: number | null
  onSelectWord: (index: number | null) => void
}

const LINE_COLORS = [
  'bg-purple-500/60',
  'bg-blue-500/60',
  'bg-cyan-500/60',
  'bg-emerald-500/60',
  'bg-amber-500/60',
  'bg-rose-500/60',
  'bg-indigo-500/60',
  'bg-teal-500/60',
]

const LINE_ACTIVE_COLORS = [
  'bg-purple-400',
  'bg-blue-400',
  'bg-cyan-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-indigo-400',
  'bg-teal-400',
]

export function WordTimeline({
  words,
  currentTime,
  duration,
  onSeek,
  onWordUpdate,
  selectedWordIndex,
  onSelectWord,
}: WordTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<{ index: number; edge: 'start' | 'end' } | null>(null)

  const effectiveDuration = Math.max(duration, 1)

  const timeToX = useCallback((time: number, containerWidth: number) => {
    return (time / effectiveDuration) * containerWidth
  }, [effectiveDuration])

  const xToTime = useCallback((x: number, containerWidth: number) => {
    return Math.max(0, Math.min((x / containerWidth) * effectiveDuration, effectiveDuration))
  }, [effectiveDuration])

  // Handle clicking on the timeline background to seek
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const time = xToTime(x, rect.width)
    onSeek(time)
  }, [isDragging, xToTime, onSeek])

  // Handle drag for word edge adjustment
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const time = xToTime(e.clientX - rect.left, rect.width)
      const word = words[isDragging.index]
      if (!word) return

      if (isDragging.edge === 'start') {
        if (time < word.end - 0.05) {
          onWordUpdate(isDragging.index, { start: Math.round(time * 1000) / 1000 })
        }
      } else {
        if (time > word.start + 0.05) {
          onWordUpdate(isDragging.index, { end: Math.round(time * 1000) / 1000 })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, words, xToTime, onWordUpdate])

  // Time markers
  const markers = []
  const step = effectiveDuration <= 10 ? 1 : effectiveDuration <= 30 ? 2 : 5
  for (let t = 0; t <= effectiveDuration; t += step) {
    markers.push(t)
  }

  return (
    <div className="flex flex-col">
      {/* Time markers */}
      <div className="relative h-5 mb-0.5">
        {markers.map(t => (
          <div
            key={t}
            className="absolute top-0 text-[9px] font-mono text-slate-600 -translate-x-1/2"
            style={{ left: `${(t / effectiveDuration) * 100}%` }}
          >
            {formatTimeCompact(t)}
          </div>
        ))}
      </div>

      {/* Timeline tracks */}
      <div
        ref={containerRef}
        className="relative h-14 bg-slate-800/50 rounded-lg border border-slate-700/30 overflow-hidden cursor-crosshair"
        onClick={handleTimelineClick}
      >
        {/* Grid lines */}
        {markers.map(t => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-px bg-slate-700/30"
            style={{ left: `${(t / effectiveDuration) * 100}%` }}
          />
        ))}

        {/* Word blocks */}
        {words.map((word, idx) => {
          const left = (word.start / effectiveDuration) * 100
          const width = ((word.end - word.start) / effectiveDuration) * 100
          const isActive = currentTime >= word.start && currentTime <= word.end
          const isSelected = selectedWordIndex === idx
          const colorIdx = word.line_index % LINE_COLORS.length
          const bgColor = isActive ? LINE_ACTIVE_COLORS[colorIdx] : LINE_COLORS[colorIdx]

          return (
            <div
              key={idx}
              className={`absolute top-1 bottom-1 rounded-md flex items-center justify-center overflow-hidden
                transition-colors duration-100 group
                ${bgColor}
                ${isSelected ? 'ring-2 ring-white/60 z-10' : ''}
                ${isActive ? 'z-10 shadow-lg' : ''}
              `}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectWord(isSelected ? null : idx)
                onSeek(word.start)
              }}
            >
              {/* Word label */}
              <span className={`text-[9px] font-medium truncate px-0.5 select-none ${
                isActive ? 'text-white' : 'text-white/80'
              }`}>
                {width > 1.5 ? word.word : ''}
              </span>

              {/* Left drag handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l-md transition-opacity"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsDragging({ index: idx, edge: 'start' })
                }}
              />

              {/* Right drag handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-r-md transition-opacity"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsDragging({ index: idx, edge: 'end' })
                }}
              />
            </div>
          )
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${(currentTime / effectiveDuration) * 100}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function formatTimeCompact(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
