import { useState, useCallback } from 'react'
import { submitCustomVideo } from '../../api/visualApi'

interface CustomVideoInputProps {
  projectId: string
  initialUrl?: string
  onSubmit: (url: string) => void
  disabled?: boolean
}

export function CustomVideoInput({
  projectId,
  initialUrl = '',
  onSubmit,
  disabled = false,
}: CustomVideoInputProps) {
  const [url, setUrl] = useState(initialUrl)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(!!initialUrl)

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      await submitCustomVideo(projectId, url.trim())
      setIsSubmitted(true)
      onSubmit(url.trim())
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err instanceof Error ? err.message : 'Failed to submit video URL')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [projectId, url, onSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && url.trim() && !isSubmitting) {
      handleSubmit()
    }
  }, [handleSubmit, url, isSubmitting])

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.182-5.567a4.5 4.5 0 00-6.364 6.364L12 10.5" />
            </svg>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setIsSubmitted(false); setError(null) }}
            onKeyDown={handleKeyDown}
            placeholder="Paste video URL (YouTube, direct MP4, etc.)"
            disabled={disabled || isSubmitting}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl
              text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!url.trim() || isSubmitting || disabled}
          className="px-5 py-3 rounded-xl font-medium text-sm
            bg-purple-600 text-white hover:bg-purple-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all flex items-center gap-2 whitespace-nowrap"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : isSubmitted ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </>
          ) : (
            'Use Video'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Success state */}
      {isSubmitted && !error && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Custom video URL saved. You can proceed to generate your reel.
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-slate-500">
        Supported: YouTube URLs, direct MP4/MOV links, or any video URL. Vertical (9:16) videos work best.
      </p>
    </div>
  )
}
