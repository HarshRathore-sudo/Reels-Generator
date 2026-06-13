import { useState, useRef } from 'react'
import type { ReelStatusItem } from '../../api/generationApi'

const STYLE_NAMES: Record<number, string> = {
  1: 'Minimal Fade',
  2: 'Karaoke Highlight',
  3: 'Word Pop',
  4: 'Typewriter',
  5: 'Stacked Lines',
  6: 'Cinematic Subtitle',
}

interface ReelCardProps {
  reel: ReelStatusItem
  onDownload?: (reel: ReelStatusItem) => void
}

export function ReelCard({ reel, onDownload }: ReelCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const styleName = STYLE_NAMES[reel.text_style] || `Style ${reel.text_style}`
  const isComplete = reel.render_status === 'complete'
  const isFailed = reel.render_status === 'failed'
  const hasVideo = isComplete && reel.output_url

  const togglePlay = () => {
    if (!videoRef.current || !hasVideo) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload(reel)
    } else if (reel.output_url) {
      // Direct download
      const a = document.createElement('a')
      a.href = reel.output_url
      a.download = `reel_style${reel.text_style}.mp4`
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <div className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all">
      {/* Video preview area */}
      <div className="relative aspect-[9/16] bg-black">
        {hasVideo && !hasError ? (
          <>
            <video
              ref={videoRef}
              src={reel.output_url!}
              className="w-full h-full object-cover"
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
              playsInline
              muted
              preload="metadata"
            />
            {/* Play/Pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
            >
              {!isPlaying && (
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </button>
          </>
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg className="w-10 h-10 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-xs text-red-400/60 px-3 text-center">
              {reel.error_message?.slice(0, 80) || 'Render failed'}
            </span>
          </div>
        ) : hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-xs text-slate-600">Preview unavailable</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        )}

        {/* Style badge overlay */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white/80">
            Style {reel.text_style}
          </span>
        </div>
      </div>

      {/* Info bar */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white truncate">{styleName}</h4>
          {isComplete && (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Ready
            </span>
          )}
        </div>

        {/* Download button */}
        {hasVideo && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
              bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium
              transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download MP4
          </button>
        )}
      </div>
    </div>
  )
}
