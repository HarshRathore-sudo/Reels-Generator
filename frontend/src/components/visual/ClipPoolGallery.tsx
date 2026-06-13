import { useState, useEffect, useCallback, useRef } from 'react'
import { buildClipPool, getClipPool, getJobStatus } from '../../api/visualApi'
import type { ClipPoolItem } from '../../types'

interface ClipPoolGalleryProps {
  projectId: string
  keywords: string[]
  onPoolReady: (clips: ClipPoolItem[]) => void
  disabled?: boolean
}

type PoolState = 'idle' | 'building' | 'ready' | 'error'

export function ClipPoolGallery({
  projectId,
  keywords,
  onPoolReady,
  disabled = false,
}: ClipPoolGalleryProps) {
  const [poolState, setPoolState] = useState<PoolState>('idle')
  const [clips, setClips] = useState<ClipPoolItem[]>([])
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if clip pool already exists on mount
  useEffect(() => {
    let cancelled = false

    async function checkExisting() {
      try {
        const result = await getClipPool(projectId)
        if (!cancelled && result.clips.length > 0) {
          setClips(result.clips)
          setPoolState('ready')
          onPoolReady(result.clips)
        }
      } catch {
        // No pool yet, that's fine
      }
    }

    checkExisting()
    return () => { cancelled = true }
  }, [projectId, onPoolReady])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  const handleBuildPool = useCallback(async () => {
    setPoolState('building')
    setProgress(0)
    setProgressMessage('Starting clip pool build...')
    setError(null)

    try {
      const { job_id } = await buildClipPool(projectId)

      // Start polling for job progress
      pollRef.current = setInterval(async () => {
        try {
          const status = await getJobStatus(job_id)

          setProgress(status.progress)
          setProgressMessage(status.message || 'Processing...')

          if (status.status === 'complete') {
            // Stop polling
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }

            // Fetch the clip pool
            const poolResult = await getClipPool(projectId)
            setClips(poolResult.clips)
            setPoolState('ready')
            onPoolReady(poolResult.clips)
          } else if (status.status === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            setPoolState('error')
            setError(status.message || 'Clip pool build failed')
          }
        } catch (err) {
          console.error('Poll error:', err)
        }
      }, 1500)

    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err instanceof Error ? err.message : 'Failed to start clip pool build')
      setError(message)
      setPoolState('error')
    }
  }, [projectId, onPoolReady])

  const handleRebuild = useCallback(() => {
    setClips([])
    setPoolState('idle')
    setError(null)
  }, [])

  // ── Render: Idle State ──────────────────────────────────────────
  if (poolState === 'idle') {
    return (
      <div className="space-y-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">
            Build Your Clip Pool
          </h3>
          <p className="text-sm text-slate-400 mb-2 max-w-md mx-auto">
            We&apos;ll search Pexels for aesthetic stock videos matching your vibe keywords
            and rank them by relevance.
          </p>

          {/* Show keywords */}
          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {keywords.map((kw, i) => (
              <span
                key={i}
                className="px-2.5 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-lg"
              >
                {kw}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleBuildPool}
            disabled={disabled}
            className="px-6 py-2.5 rounded-xl font-medium text-sm
              bg-purple-600 text-white hover:bg-purple-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search & Build Pool
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Building State ──────────────────────────────────────
  if (poolState === 'building') {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-purple-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Building Clip Pool
          </h3>
          <p className="text-sm text-slate-400">
            {progressMessage}
          </p>
        </div>

        {/* Progress bar */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Error State ─────────────────────────────────────────
  if (poolState === 'error') {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 bg-red-500/10 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Build Failed</h3>
        <p className="text-sm text-red-300 mb-4">{error}</p>
        <button
          type="button"
          onClick={handleRebuild}
          className="px-5 py-2 rounded-xl font-medium text-sm
            bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  // ── Render: Ready State — Clip Gallery ──────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-sm text-green-400 font-medium">
            {clips.length} clips found
          </span>
        </div>
        <button
          type="button"
          onClick={handleRebuild}
          disabled={disabled}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Rebuild
        </button>
      </div>

      {/* Clip Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {clips.map((clip, index) => (
          <ClipCard key={clip.id} clip={clip} rank={index + 1} />
        ))}
      </div>
    </div>
  )
}


// ── Clip Card ──────────────────────────────────────────────────────

interface ClipCardProps {
  clip: ClipPoolItem
  rank: number
}

function ClipCard({ clip, rank }: ClipCardProps) {
  return (
    <div className="group relative bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden
      hover:border-purple-500/30 transition-all">
      {/* Thumbnail area (aspect ratio 9:16, but shown as card) */}
      <div className="aspect-[9/12] bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center relative">
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Rank badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/50 text-white/80 backdrop-blur-sm">
            #{rank}
          </span>
        </div>

        {/* Relevance score */}
        <div className="absolute top-2 right-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-500/30 text-purple-300 backdrop-blur-sm">
            {Math.round(clip.relevance_score * 100)}%
          </span>
        </div>

        {/* Resolution badge */}
        <div className="absolute bottom-2 left-2">
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-slate-300 backdrop-blur-sm">
            {clip.width}x{clip.height}
          </span>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2">
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-slate-300 backdrop-blur-sm">
            {formatSeconds(clip.duration_seconds)}
          </span>
        </div>
      </div>
    </div>
  )
}


function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
