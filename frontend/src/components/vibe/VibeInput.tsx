import { useState, useCallback } from 'react'
import { suggestVibe } from '../../api/vibeApi'

interface VibeInputProps {
  projectId: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * VibeInput: Textarea with "Suggest Vibe" AI button.
 *
 * Allows the user to:
 * 1. Type a vibe description manually
 * 2. Click "Suggest Vibe" to get an AI suggestion based on lyrics + audio
 * 3. Edit the AI suggestion before saving
 */
export function VibeInput({ projectId, value, onChange, disabled = false }: VibeInputProps) {
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  const handleSuggest = useCallback(async () => {
    setIsSuggesting(true)
    setSuggestError(null)

    try {
      const result = await suggestVibe(projectId)
      onChange(result.suggestion)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err instanceof Error ? err.message : 'Failed to get suggestion')
      setSuggestError(message)
    } finally {
      setIsSuggesting(false)
    }
  }, [projectId, onChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">
          Vibe Description
        </label>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={disabled || isSuggesting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            bg-purple-600/20 text-purple-300 border border-purple-500/30
            hover:bg-purple-600/30 hover:border-purple-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all"
        >
          {isSuggesting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Thinking...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              Suggest Vibe
            </>
          )}
        </button>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the vibe... e.g., 'late night drive, neon city lights, melancholic longing'"
        disabled={disabled || isSuggesting}
        maxLength={1000}
        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl
          text-white placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-none transition-all"
        rows={3}
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {value.length > 0
            ? `${value.length}/1000 characters`
            : 'Describe the visual mood, setting, and aesthetic'}
        </span>
        {isSuggesting && (
          <span className="text-purple-400 animate-pulse">
            AI is analyzing your lyrics and beats...
          </span>
        )}
      </div>

      {suggestError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {suggestError}
        </div>
      )}
    </div>
  )
}
