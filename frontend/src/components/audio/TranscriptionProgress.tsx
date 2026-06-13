import { useState, useEffect, useCallback, useRef } from 'react'
import { startTranscription, getJobStatus } from '../../api/audioApi'
import type { Language, JobInfo } from '../../types'

const POLL_INTERVAL = 1500 // 1.5 seconds

const LANGUAGE_LABELS: Record<Language, string> = {
  hi_dev: 'Hindi (Devanagari)',
  hi_rom: 'Hindi (Roman/Hinglish)',
  en: 'English',
}

interface TranscriptionProgressProps {
  projectId: string
  defaultLanguage: Language
  onTranscriptionComplete: () => void
  onBack: () => void
}

export function TranscriptionProgress({
  projectId,
  defaultLanguage,
  onTranscriptionComplete,
  onBack,
}: TranscriptionProgressProps) {
  const [language, setLanguage] = useState<Language>(defaultLanguage)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobInfo | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

  // Poll job status
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId)
        setJobStatus(status)

        if (status.status === 'complete') {
          // Stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          // Wait a moment to show 100% then notify parent
          setTimeout(() => {
            onTranscriptionComplete()
          }, 1000)
        } else if (status.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setError(status.message || 'Transcription failed')
          setJobId(null)
        }
      } catch {
        // Network error during polling - keep trying
        console.warn('Job poll failed, retrying...')
      }
    }

    // Initial poll
    poll()

    // Set up interval
    pollRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [jobId, onTranscriptionComplete])

  const handleStart = useCallback(async () => {
    setIsStarting(true)
    setError(null)

    try {
      const { job_id } = await startTranscription(projectId, language)
      setJobId(job_id)
      setJobStatus({
        job_id,
        status: 'queued',
        progress: 0,
        message: 'Starting transcription...',
        result: null,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start transcription'
      const apiMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(apiMessage || message)
    } finally {
      setIsStarting(false)
    }
  }, [projectId, language])

  const isProcessing = jobId !== null && jobStatus?.status !== 'complete' && jobStatus?.status !== 'failed'
  const progress = jobStatus?.progress ?? 0
  const statusMessage = jobStatus?.message ?? ''

  // Stage icons for progress visualization
  const stages = [
    { key: 'loading', label: 'Loading', icon: 'folder' },
    { key: 'downloading', label: 'Downloading', icon: 'download' },
    { key: 'transcribing', label: 'Transcribing', icon: 'mic' },
    { key: 'aligning', label: 'Aligning', icon: 'align' },
    { key: 'saving', label: 'Saving', icon: 'save' },
  ]

  const currentStageIndex = (() => {
    if (!jobStatus) return -1
    if (progress <= 10) return 0
    if (progress <= 20) return 1
    if (progress <= 70) return 2
    if (progress <= 85) return 3
    return 4
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Transcribe Audio</h2>
          <p className="text-slate-400 text-sm">
            Generate word-level lyrics with timing from your audio
          </p>
        </div>
        {!isProcessing && (
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Back to trim
          </button>
        )}
      </div>

      {/* Language Selection (only before starting) */}
      {!isProcessing && !jobStatus?.result && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select Language
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    language === code
                      ? 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/40'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Start Transcription
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress View */}
      {isProcessing && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 space-y-6">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                {statusMessage || 'Processing...'}
              </span>
              <span className="text-sm font-mono text-purple-300">{progress}%</span>
            </div>
            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stage indicators */}
          <div className="flex items-center justify-between">
            {stages.map((stage, idx) => {
              const isActive = idx === currentStageIndex
              const isDone = idx < currentStageIndex
              const isFuture = idx > currentStageIndex

              return (
                <div key={stage.key} className="flex flex-col items-center gap-1.5">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs
                    transition-all duration-300
                    ${isActive ? 'bg-purple-600 text-white scale-110' : ''}
                    ${isDone ? 'bg-purple-600/30 text-purple-300' : ''}
                    ${isFuture ? 'bg-slate-700 text-slate-500' : ''}
                  `}>
                    {isDone ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : isActive ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-purple-300' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="text-center text-slate-500 text-xs">
            This usually takes 5-10 seconds...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setError(null)
              setJobId(null)
              setJobStatus(null)
            }}
            className="mt-3 text-sm text-slate-300 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
