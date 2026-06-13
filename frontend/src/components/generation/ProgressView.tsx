import { useEffect, useRef, useState } from 'react'
import type { ReelStatusItem, BatchStatusResponse } from '../../api/generationApi'
import { getBatchStatus } from '../../api/generationApi'

const STYLE_NAMES: Record<number, string> = {
  1: 'Minimal Fade',
  2: 'Karaoke Highlight',
  3: 'Word Pop',
  4: 'Typewriter',
  5: 'Stacked Lines',
  6: 'Cinematic Subtitle',
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  queued: { color: 'text-slate-400', bg: 'bg-slate-600' },
  rendering: { color: 'text-amber-400', bg: 'bg-amber-500' },
  complete: { color: 'text-green-400', bg: 'bg-green-500' },
  failed: { color: 'text-red-400', bg: 'bg-red-500' },
}

interface ProgressViewProps {
  projectId: string
  batchNumber: number
  jobIds: string[]
  onAllComplete: (reels: ReelStatusItem[]) => void
}

export function ProgressView({ projectId, batchNumber, onAllComplete }: ProgressViewProps) {
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [pollError, setPollError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const errorCountRef = useRef(0)

  useEffect(() => {
    if (!isPolling) return

    const poll = async () => {
      try {
        const status = await getBatchStatus(projectId, batchNumber)
        setBatchStatus(status)
        setPollError(false)
        errorCountRef.current = 0

        if (status.all_complete) {
          setIsPolling(false)
          onAllComplete(status.reels)
        }
      } catch (err) {
        errorCountRef.current += 1
        console.error('Failed to poll batch status:', err)

        // Stop polling after 10 consecutive failures
        if (errorCountRef.current >= 10) {
          setIsPolling(false)
          setPollError(true)
        }
      }
    }

    // Poll immediately, then every 2 seconds
    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [projectId, batchNumber, isPolling, onAllComplete])

  const reels = batchStatus?.reels || []
  const totalComplete = batchStatus?.complete || 0
  const totalFailed = batchStatus?.failed || 0
  const total = batchStatus?.total || 6
  const overallProgress = total > 0 ? Math.round(((totalComplete + totalFailed) / total) * 100) : 0

  // Handle poll error state
  if (pollError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <svg className="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-red-400 mb-3">Lost connection to the server while checking progress.</p>
        <button
          onClick={() => { errorCountRef.current = 0; setPollError(false); setIsPolling(true) }}
          className="text-sm text-purple-300 hover:text-purple-200 underline transition-colors"
        >
          Resume polling
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall progress header */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              {isPolling ? (
                <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold">
                {isPolling ? 'Generating Reels...' : 'Generation Complete'}
              </h3>
              <p className="text-sm text-slate-400">
                Batch {batchNumber} - {totalComplete}/{total} complete
                {totalFailed > 0 && <span className="text-red-400"> ({totalFailed} failed)</span>}
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-purple-300">{overallProgress}%</span>
        </div>

        {/* Overall progress bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-purple-600 to-purple-400"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Individual reel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {(reels.length > 0 ? reels : Array.from({ length: 6 }, (_, i) => ({
          reel_id: `placeholder-${i}`,
          text_style: i + 1,
          render_status: 'queued',
          output_url: null,
          error_message: null,
          render_started_at: null,
          render_completed_at: null,
          batch_number: batchNumber,
          project_id: projectId,
        } as ReelStatusItem))).map((reel) => (
          <ReelProgressCard key={reel.reel_id} reel={reel} />
        ))}
      </div>
    </div>
  )
}

function ReelProgressCard({ reel }: { reel: ReelStatusItem }) {
  const status = reel.render_status
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued
  const styleName = STYLE_NAMES[reel.text_style] || `Style ${reel.text_style}`

  // Calculate time elapsed
  const elapsed = reel.render_started_at && reel.render_completed_at
    ? formatElapsed(new Date(reel.render_completed_at).getTime() - new Date(reel.render_started_at).getTime())
    : reel.render_started_at
      ? 'In progress...'
      : null

  return (
    <div className={`
      relative bg-slate-800/50 border rounded-xl p-4
      transition-all duration-300
      ${status === 'rendering' ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : ''}
      ${status === 'complete' ? 'border-green-500/30' : ''}
      ${status === 'failed' ? 'border-red-500/30' : ''}
      ${status === 'queued' ? 'border-slate-700/50' : ''}
    `}>
      {/* Style badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300">
          Style {reel.text_style}
        </span>
        <StatusIcon status={status} />
      </div>

      {/* Style name */}
      <h4 className="text-sm font-medium text-white mb-1">{styleName}</h4>

      {/* Status text */}
      <p className={`text-xs ${config.color}`}>
        {status === 'queued' && 'Waiting...'}
        {status === 'rendering' && 'Rendering...'}
        {status === 'complete' && 'Done!'}
        {status === 'failed' && (reel.error_message?.slice(0, 60) || 'Render failed')}
      </p>

      {/* Time elapsed */}
      {elapsed && (
        <p className="text-xs text-slate-500 mt-1">{elapsed}</p>
      )}

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.bg}`}
          style={{
            width: status === 'queued' ? '0%' :
                   status === 'rendering' ? '60%' :
                   status === 'complete' ? '100%' :
                   status === 'failed' ? '100%' : '0%',
          }}
        />
      </div>

      {/* Rendering shimmer */}
      {status === 'rendering' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'queued') {
    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (status === 'rendering') {
    return (
      <svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )
  }
  if (status === 'complete') {
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  return null
}

function formatElapsed(ms: number): string {
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return `${mins}m ${remainSecs}s`
}
