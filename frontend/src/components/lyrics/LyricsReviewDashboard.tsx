import { useState, useEffect, useCallback, useRef } from 'react'
import { getLyrics, updateLyrics } from '../../api/lyricsApi'
import { getAudioDownloadUrl } from '../../api/audioApi'
import { LyricsListPanel } from './LyricsListPanel'
import { BlackPreview } from './BlackPreview'
import { TextStylePicker } from './TextStylePicker'
import { WordTimeline } from './WordTimeline'
import type { Word, Lyrics } from '../../types'

interface LyricsReviewDashboardProps {
  projectId: string
  onComplete: () => void
  onBack: () => void
}

export function LyricsReviewDashboard({
  projectId,
  onComplete,
  onBack,
}: LyricsReviewDashboardProps) {
  // Data state
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // UI state
  const [textStyle, setTextStyle] = useState(1)
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Fetch lyrics and audio URL on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [lyricsData, audioData] = await Promise.all([
          getLyrics(projectId),
          getAudioDownloadUrl(projectId, true).catch(() => getAudioDownloadUrl(projectId, false)),
        ])
        setLyrics(lyricsData)
        setWords(lyricsData.words)
        setAudioUrl(audioData.download_url)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load lyrics'
        const apiMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setError(apiMsg || msg)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [projectId])

  // Set up audio element
  useEffect(() => {
    if (!audioUrl) return

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [audioUrl])

  // Animation frame loop for current time
  useEffect(() => {
    const update = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime)
      }
      animFrameRef.current = requestAnimationFrame(update)
    }

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(update)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying])

  // Playback controls
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  // Word operations
  const handleWordUpdate = useCallback((index: number, updates: Partial<Word>) => {
    setWords(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
    setHasChanges(true)
    setSaveMessage(null)
  }, [])

  const handleWordDelete = useCallback((index: number) => {
    setWords(prev => prev.filter((_, i) => i !== index))
    setSelectedWordIndex(null)
    setHasChanges(true)
    setSaveMessage(null)
  }, [])

  const handleWordAdd = useCallback((afterIndex: number) => {
    setWords(prev => {
      const next = [...prev]
      const afterWord = next[afterIndex]
      const newWord: Word = {
        word: '...',
        start: afterWord.end,
        end: afterWord.end + 0.5,
        line_index: afterWord.line_index,
      }
      next.splice(afterIndex + 1, 0, newWord)
      return next
    })
    setHasChanges(true)
    setSaveMessage(null)
  }, [])

  // Save changes
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const updated = await updateLyrics(projectId, words)
      setLyrics(updated)
      setWords(updated.words)
      setHasChanges(false)
      setSaveMessage('Saved successfully')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      const apiMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSaveMessage(`Error: ${apiMsg || msg}`)
    } finally {
      setIsSaving(false)
    }
  }, [projectId, words])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when editing text
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlayback()
      } else if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (hasChanges) handleSave()
      } else if (e.code === 'Escape') {
        setSelectedWordIndex(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlayback, hasChanges, handleSave])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading lyrics...
        </div>
      </div>
    )
  }

  if (error || !lyrics) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-red-300 text-sm">{error || 'No lyrics found'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 -mx-6 -mt-2">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <h2 className="text-lg font-semibold text-white">Lyrics Review</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          {saveMessage && (
            <span className={`text-xs ${
              saveMessage.startsWith('Error') ? 'text-red-400' : 'text-green-400'
            }`}>
              {saveMessage}
            </span>
          )}

          {hasChanges && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              hasChanges
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={onComplete}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Main 3-panel layout */}
      <div className="grid grid-cols-12 gap-3 px-6" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        {/* Left panel: Lyrics list */}
        <div className="col-span-5 bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
          <LyricsListPanel
            words={words}
            currentTime={currentTime}
            onWordUpdate={handleWordUpdate}
            onWordDelete={handleWordDelete}
            onWordAdd={handleWordAdd}
            onSeek={handleSeek}
            selectedWordIndex={selectedWordIndex}
            onSelectWord={setSelectedWordIndex}
          />
        </div>

        {/* Center panel: Black preview */}
        <div className="col-span-4 bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
          <BlackPreview
            words={words}
            currentTime={currentTime}
            textStyle={textStyle}
            isPlaying={isPlaying}
          />
        </div>

        {/* Right panel: Style picker */}
        <div className="col-span-3 bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
          <TextStylePicker
            selectedStyle={textStyle}
            onSelectStyle={setTextStyle}
          />
        </div>
      </div>

      {/* Bottom area: Transport + Timeline */}
      <div className="px-6 space-y-3 pb-4">
        {/* Audio transport controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={togglePlayback}
            disabled={!audioUrl}
            className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
              </svg>
            )}
          </button>

          {/* Rewind 5s */}
          <button
            onClick={() => handleSeek(Math.max(0, currentTime - 5))}
            className="text-slate-400 hover:text-white transition-colors"
            title="Rewind 5s"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062a1.125 1.125 0 011.683.977v8.123z" />
            </svg>
          </button>

          {/* Forward 5s */}
          <button
            onClick={() => handleSeek(Math.min(duration, currentTime + 5))}
            className="text-slate-400 hover:text-white transition-colors"
            title="Forward 5s"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
            </svg>
          </button>

          {/* Time display */}
          <div className="text-sm font-mono text-slate-400">
            <span className="text-white">{formatTimeFull(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTimeFull(duration)}</span>
          </div>

          {/* Spacebar hint */}
          <div className="ml-auto text-[10px] text-slate-600">
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-500">Space</kbd> play/pause
            <span className="mx-2">|</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-500">Ctrl+S</kbd> save
          </div>
        </div>

        {/* Word timeline */}
        <WordTimeline
          words={words}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          onWordUpdate={handleWordUpdate}
          selectedWordIndex={selectedWordIndex}
          onSelectWord={setSelectedWordIndex}
        />
      </div>
    </div>
  )
}

function formatTimeFull(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
