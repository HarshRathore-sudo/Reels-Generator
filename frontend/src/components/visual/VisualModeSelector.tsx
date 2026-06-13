import { useState } from 'react'
import type { VisualMode } from '../../types'

interface VisualModeSelectorProps {
  initialMode: VisualMode | null
  onSelect: (mode: VisualMode) => void
  disabled?: boolean
}

export function VisualModeSelector({ initialMode, onSelect, disabled = false }: VisualModeSelectorProps) {
  const [selected, setSelected] = useState<VisualMode | null>(initialMode)

  const handleSelect = (mode: VisualMode) => {
    if (disabled) return
    setSelected(mode)
    onSelect(mode)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Stock Videos Card */}
      <button
        type="button"
        onClick={() => handleSelect('stock')}
        disabled={disabled}
        className={`
          relative overflow-hidden rounded-2xl border-2 p-6 text-left
          transition-all duration-200 group
          ${selected === 'stock'
            ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
            : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${selected === 'stock' ? 'bg-purple-500/20' : 'bg-slate-700'}
        `}>
          <svg className={`w-6 h-6 ${selected === 'stock' ? 'text-purple-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-white mb-1">
          Aesthetic Stock Videos
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          AI-curated clips from Pexels matched to your vibe. We&apos;ll search, filter, and rank the best vertical videos automatically.
        </p>

        {/* Recommended badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
            Recommended
          </span>
        </div>

        {/* Selected checkmark */}
        {selected === 'stock' && (
          <div className="absolute bottom-3 right-3">
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
        )}
      </button>

      {/* Custom Video Card */}
      <button
        type="button"
        onClick={() => handleSelect('custom')}
        disabled={disabled}
        className={`
          relative overflow-hidden rounded-2xl border-2 p-6 text-left
          transition-all duration-200 group
          ${selected === 'custom'
            ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
            : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${selected === 'custom' ? 'bg-purple-500/20' : 'bg-slate-700'}
        `}>
          <svg className={`w-6 h-6 ${selected === 'custom' ? 'text-purple-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-white mb-1">
          Custom Video
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Use your own background video. Paste a URL or upload a video file to use as the visual backdrop for your reel.
        </p>

        {/* Selected checkmark */}
        {selected === 'custom' && (
          <div className="absolute bottom-3 right-3">
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
        )}
      </button>
    </div>
  )
}
