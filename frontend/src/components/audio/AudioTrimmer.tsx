import { useRef, useEffect, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { trimAudio } from '../../api/audioApi'
import type { AudioFile } from '../../types'

const MAX_TRIM_DURATION = 30 // seconds

interface AudioTrimmerProps {
  projectId: string
  audioFile: AudioFile
  /** The actual audio source (File object or URL from presigned download) */
  audioSrc: File | string
  onTrimComplete: (audio: AudioFile) => void
  onBack: () => void
}

export function AudioTrimmer({
  projectId,
  audioFile,
  audioSrc,
  onTrimComplete,
  onBack,
}: AudioTrimmerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const totalDurationRef = useRef<number>(0)

  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isTrimming, setIsTrimming] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(Math.min(MAX_TRIM_DURATION, audioFile.duration_seconds))
  const [trimError, setTrimError] = useState<string | null>(null)

  // Initialize WaveSurfer with Regions plugin
  useEffect(() => {
    if (!containerRef.current) return

    const regions = RegionsPlugin.create()

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 100,
      waveColor: '#475569',
      progressColor: '#7c3aed',
      cursorColor: '#e2e8f0',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      plugins: [regions],
    })

    wavesurferRef.current = ws

    ws.on('ready', () => {
      const dur = ws.getDuration()
      totalDurationRef.current = dur
      setDuration(dur)
      setIsReady(true)

      // Set initial trim region
      const end = Math.min(MAX_TRIM_DURATION, dur)
      setTrimEnd(end)

      // Create the trim region
      regions.addRegion({
        id: 'trim-region',
        start: 0,
        end: end,
        color: 'rgba(124, 58, 237, 0.2)',
        drag: true,
        resize: true,
      })
    })

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime())
    })

    ws.on('seeking', () => {
      setCurrentTime(ws.getCurrentTime())
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    // Handle region updates
    regions.on('region-updated', (region) => {
      if (region.id === 'trim-region') {
        let start = region.start
        let end = region.end
        const regionDuration = end - start
        const totalDur = totalDurationRef.current

        // Enforce max duration
        if (regionDuration > MAX_TRIM_DURATION) {
          end = start + MAX_TRIM_DURATION
          if (end > totalDur) {
            end = totalDur
            start = Math.max(0, end - MAX_TRIM_DURATION)
          }
          region.setOptions({ start, end })
        }

        setTrimStart(start)
        setTrimEnd(end)
      }
    })

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

  const playRegion = useCallback(() => {
    const ws = wavesurferRef.current
    if (!ws) return

    ws.setTime(trimStart)
    ws.play()

    // Stop at region end
    const checkEnd = () => {
      if (ws.getCurrentTime() >= trimEnd) {
        ws.pause()
        ws.un('audioprocess', checkEnd)
      }
    }
    ws.on('audioprocess', checkEnd)
  }, [trimStart, trimEnd])

  const handleTrim = useCallback(async () => {
    setIsTrimming(true)
    setTrimError(null)

    try {
      const result = await trimAudio(projectId, {
        start_sec: Math.round(trimStart * 100) / 100,
        end_sec: Math.round(trimEnd * 100) / 100,
      })
      onTrimComplete(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trim failed'
      const apiMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTrimError(apiMessage || message)
    } finally {
      setIsTrimming(false)
    }
  }, [projectId, trimStart, trimEnd, onTrimComplete])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  const trimDuration = trimEnd - trimStart

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Trim Audio</h3>
          <p className="text-sm text-slate-400">
            Select a segment up to {MAX_TRIM_DURATION} seconds for your reel
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Replace audio
        </button>
      </div>

      {/* Waveform */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        {!isReady && (
          <div className="flex items-center justify-center h-[100px]">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading waveform...
            </div>
          </div>
        )}
        <div ref={containerRef} className={isReady ? '' : 'hidden'} />

        {/* Playback controls */}
        {isReady && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={togglePlay}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play full track'}
              title="Play full track"
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

            <button
              onClick={playRegion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-colors text-sm"
              title="Preview selected region"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Preview selection
            </button>

            <span className="text-sm text-slate-500 font-mono tabular-nums ml-auto">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Trim info */}
      {isReady && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Start</p>
            <p className="text-lg font-mono text-slate-200 tabular-nums mt-1">
              {formatTime(trimStart)}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Duration</p>
            <p className={`text-lg font-mono tabular-nums mt-1 ${
              trimDuration > MAX_TRIM_DURATION ? 'text-red-400' : 'text-purple-300'
            }`}>
              {formatTime(trimDuration)}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">End</p>
            <p className="text-lg font-mono text-slate-200 tabular-nums mt-1">
              {formatTime(trimEnd)}
            </p>
          </div>
        </div>
      )}

      {/* Trim error */}
      {trimError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{trimError}</span>
        </div>
      )}

      {/* Actions */}
      {isReady && (
        <div className="flex justify-end gap-3">
          {duration <= MAX_TRIM_DURATION && (
            <button
              onClick={() => onTrimComplete(audioFile)}
              className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors text-sm"
            >
              Use full audio ({formatTime(duration)})
            </button>
          )}
          <button
            onClick={handleTrim}
            disabled={isTrimming || trimDuration > MAX_TRIM_DURATION || trimDuration < 1}
            className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors text-sm flex items-center gap-2"
          >
            {isTrimming ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Trimming...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                Trim to {formatTime(trimDuration)}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
