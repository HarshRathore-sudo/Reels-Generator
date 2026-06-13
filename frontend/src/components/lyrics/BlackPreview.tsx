import { useMemo } from 'react'
import type { Word } from '../../types'

interface BlackPreviewProps {
  words: Word[]
  currentTime: number
  textStyle: number
  isPlaying: boolean
}

interface LineData {
  lineIndex: number
  text: string
  words: Word[]
  start: number
  end: number
}

function getLineData(words: Word[]): LineData[] {
  const map = new Map<number, Word[]>()
  words.forEach(w => {
    const arr = map.get(w.line_index) || []
    arr.push(w)
    map.set(w.line_index, arr)
  })

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([lineIndex, lineWords]) => ({
      lineIndex,
      text: lineWords.map(w => w.word).join(' '),
      words: lineWords,
      start: Math.min(...lineWords.map(w => w.start)),
      end: Math.max(...lineWords.map(w => w.end)),
    }))
}

// ─── Style-specific render functions (matching backend Phase 10) ────

interface StyleRenderer {
  name: string
  renderContent: (props: {
    lines: LineData[]
    currentTime: number
    words: Word[]
  }) => React.ReactNode
}

const TEXT_STYLES: Record<number, StyleRenderer> = {
  // Style 1: Minimal Fade - one word at a time, centered
  1: {
    name: 'Minimal Fade',
    renderContent: ({ words, currentTime }) => {
      const activeWord = words.find(w => currentTime >= w.start && currentTime <= w.end)
      const nextWord = words.find(w => w.start > currentTime)

      // Calculate fade alpha for the active word
      let opacity = 0
      if (activeWord) {
        const dur = activeWord.end - activeWord.start
        const elapsed = currentTime - activeWord.start
        const fadeIn = Math.min(0.15, dur * 0.3)
        const fadeOut = Math.min(0.10, dur * 0.3)

        if (elapsed < fadeIn) {
          opacity = elapsed / fadeIn
        } else if (elapsed > dur - fadeOut) {
          opacity = (dur - elapsed) / fadeOut
        } else {
          opacity = 1
        }
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center">
          {activeWord ? (
            <span
              className="text-2xl font-bold text-white text-center px-4"
              style={{
                opacity: Math.max(0, Math.min(1, opacity)),
                textShadow: '4px 4px 0px rgba(0,0,0,0.6)',
                transition: 'opacity 0.05s linear',
              }}
            >
              {activeWord.word}
            </span>
          ) : nextWord ? (
            <span className="text-sm text-white/10">...</span>
          ) : null}
        </div>
      )
    },
  },

  // Style 2: Karaoke - full line at bottom, active word highlights
  2: {
    name: 'Karaoke',
    renderContent: ({ lines, currentTime }) => {
      const activeLine = lines.find(l => currentTime >= l.start && currentTime <= l.end)

      return (
        <div className="absolute bottom-[20%] left-0 right-0 px-3">
          {activeLine ? (
            <div className="bg-black/40 rounded-lg px-3 py-2">
              <div className="flex flex-wrap justify-center gap-x-1 text-base font-bold">
                {activeLine.words.map((w, i) => {
                  const isActive = currentTime >= w.start && currentTime <= w.end
                  const isPast = currentTime > w.end
                  return (
                    <span
                      key={i}
                      className={`transition-colors duration-100 ${
                        isActive
                          ? 'text-white'
                          : isPast
                            ? 'text-white/70'
                            : 'text-white/40'
                      }`}
                    >
                      {w.word}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-white/10 text-xs">...</div>
          )}
        </div>
      )
    },
  },

  // Style 3: Word Pop - large single word, centered, pop effect
  3: {
    name: 'Word Pop',
    renderContent: ({ words, currentTime }) => {
      const activeWord = words.find(w => currentTime >= w.start && currentTime <= w.end)

      let scale = 1
      if (activeWord) {
        const dur = activeWord.end - activeWord.start
        const elapsed = currentTime - activeWord.start
        const popIn = Math.min(0.08, dur * 0.25)

        if (elapsed < popIn) {
          scale = 0.85 + (0.15 * elapsed / popIn)
        } else {
          scale = 1
        }
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center">
          {activeWord ? (
            <span
              className="text-3xl font-black text-white text-center uppercase tracking-wide"
              style={{
                transform: `scale(${scale})`,
                WebkitTextStroke: '1px rgba(0,0,0,0.8)',
                transition: 'transform 0.05s ease-out',
              }}
            >
              {activeWord.word}
            </span>
          ) : null}
        </div>
      )
    },
  },

  // Style 4: Typewriter - words accumulate on line
  4: {
    name: 'Typewriter',
    renderContent: ({ lines, currentTime }) => {
      const activeLine = lines.find(l => currentTime >= l.start && currentTime <= l.end)

      if (!activeLine) return null

      // Show accumulated words up to current time
      const visibleWords = activeLine.words.filter(w => currentTime >= w.start)

      return (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="text-center">
            <span className="text-base font-bold text-white" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>
              {visibleWords.map((w, i) => (
                <span
                  key={i}
                  className="inline-block"
                  style={{
                    opacity: currentTime - w.start < 0.08 ? (currentTime - w.start) / 0.08 : 1,
                    transition: 'opacity 0.05s linear',
                  }}
                >
                  {w.word}{i < visibleWords.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
          </div>
        </div>
      )
    },
  },

  // Style 5: Stacked Lines - current large, previous smaller
  5: {
    name: 'Stacked Lines',
    renderContent: ({ lines, currentTime }) => {
      const activeIdx = lines.findIndex(l => currentTime >= l.start && currentTime <= l.end)

      // Determine which lines to show
      const showLines: { line: LineData; role: 'older' | 'prev' | 'current' }[] = []

      if (activeIdx >= 0) {
        if (activeIdx >= 2) showLines.push({ line: lines[activeIdx - 2], role: 'older' })
        if (activeIdx >= 1) showLines.push({ line: lines[activeIdx - 1], role: 'prev' })
        showLines.push({ line: lines[activeIdx], role: 'current' })
      } else {
        // Find the nearest upcoming line
        const nextIdx = lines.findIndex(l => l.start > currentTime)
        if (nextIdx > 0) {
          // Between lines — show previous as fading
          showLines.push({ line: lines[nextIdx - 1], role: 'current' })
        }
      }

      const sizeMap = {
        older: 'text-[10px] text-white/25',
        prev: 'text-xs text-white/50',
        current: 'text-lg text-white font-bold',
      }

      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          {showLines.map(({ line, role }) => (
            <div key={line.lineIndex} className={`text-center transition-all duration-300 ${sizeMap[role]}`}>
              {line.text}
            </div>
          ))}
        </div>
      )
    },
  },

  // Style 6: Cinematic - clean subtitle at bottom with background
  6: {
    name: 'Cinematic',
    renderContent: ({ lines, currentTime }) => {
      // Find active line with pre-appear (200ms before) and post-fade (200ms after)
      const activeLine = lines.find(l => {
        const preStart = Math.max(0, l.start - 0.2)
        const postEnd = l.end + 0.2
        return currentTime >= preStart && currentTime <= postEnd
      })

      if (!activeLine) return null

      // Calculate fade
      const preStart = Math.max(0, activeLine.start - 0.2)
      const postEnd = activeLine.end + 0.2
      const fadeDur = 0.2
      let opacity = 1

      if (currentTime < preStart + fadeDur) {
        opacity = (currentTime - preStart) / fadeDur
      } else if (currentTime > postEnd - fadeDur) {
        opacity = (postEnd - currentTime) / fadeDur
      }

      return (
        <div className="absolute bottom-[15%] left-0 right-0 px-3">
          <div
            className="bg-black/30 rounded px-3 py-1.5 text-center"
            style={{ opacity: Math.max(0, Math.min(1, opacity)), transition: 'opacity 0.1s linear' }}
          >
            <span className="text-sm font-normal text-white tracking-widest">
              {activeLine.text}
            </span>
          </div>
        </div>
      )
    },
  },
}

export function BlackPreview({
  words,
  currentTime,
  textStyle,
  isPlaying,
}: BlackPreviewProps) {
  const lines = useMemo(() => getLineData(words), [words])
  const style = TEXT_STYLES[textStyle] || TEXT_STYLES[1]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Preview
        </h3>
        <div className="flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-3 bg-purple-400 rounded-full animate-pulse" />
              <div className="w-1.5 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
              <div className="w-1.5 h-2.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
            </div>
          )}
          <span className="text-xs font-mono text-slate-500">
            {style.name}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {/* 9:16 frame */}
        <div className="relative w-full max-w-[240px] bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
             style={{ aspectRatio: '9/16' }}>
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />

          {/* Text content using style-specific renderer */}
          {words.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/20 text-sm text-center">No lyrics yet</p>
            </div>
          ) : (
            style.renderContent({ lines, currentTime, words })
          )}

          {/* Time indicator */}
          <div className="absolute bottom-3 right-3">
            <span className="text-[10px] font-mono text-white/20">
              {formatTimeShort(currentTime)}
            </span>
          </div>

          {/* Style badge */}
          <div className="absolute top-3 left-3">
            <span className="text-[9px] font-mono text-white/15 bg-white/5 px-1.5 py-0.5 rounded">
              Style {textStyle}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
