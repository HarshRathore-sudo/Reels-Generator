import { useRef, useEffect, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WaveformPreviewProps {
  /** Audio source - URL or File/Blob */
  audioSrc: string | File | Blob
  /** Height of the waveform in pixels */
  height?: number
  /** Waveform color */
  waveColor?: string
  /** Progress/played color */
  progressColor?: string
  /** Whether to show play controls */
  showControls?: boolean
  /** Callback when audio is ready (receives duration) */
  onReady?: (duration: number) => void
  /** Callback on current time update during playback */
  onTimeUpdate?: (currentTime: number) => void
  /** Ref callback to expose wavesurfer instance */
  onWaveSurferReady?: (ws: WaveSurfer) => void
}

export function WaveformPreview({
  audioSrc,
  height = 80,
  waveColor = '#7c3aed',
  progressColor = '#a855f7',
  showControls = true,
  onReady,
  onTimeUpdate,
  onWaveSurferReady,
}: WaveformPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor,
      progressColor,
      cursorColor: '#e2e8f0',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: 'WebAudio',
    })

    wavesurferRef.current = ws

    ws.on('ready', () => {
      const dur = ws.getDuration()
      setDuration(dur)
      setIsLoading(false)
      onReady?.(dur)
      onWaveSurferReady?.(ws)
    })

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime()
      setCurrentTime(time)
      onTimeUpdate?.(time)
    })

    ws.on('seeking', () => {
      const time = ws.getCurrentTime()
      setCurrentTime(time)
      onTimeUpdate?.(time)
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    // Load the audio
    if (audioSrc instanceof File || audioSrc instanceof Blob) {
      ws.loadBlob(audioSrc)
    } else if (audioSrc) {
      ws.load(audioSrc)
    }

    return () => {
      ws.destroy()
      wavesurferRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc])

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause()
  }, [])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full">
      {/* Loading state */}
      {isLoading && (
        <div
          className="flex items-center justify-center bg-slate-800/50 rounded-lg"
          style={{ height: `${height}px` }}
        >
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading waveform...
          </div>
        </div>
      )}

      {/* Waveform container */}
      <div
        ref={containerRef}
        className={`rounded-lg ${isLoading ? 'hidden' : ''}`}
      />

      {/* Controls */}
      {showControls && !isLoading && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={togglePlay}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="text-sm text-slate-400 font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  )
}
