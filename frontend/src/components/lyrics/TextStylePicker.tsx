interface TextStylePickerProps {
  selectedStyle: number
  onSelectStyle: (style: number) => void
}

const STYLES: {
  id: number
  name: string
  description: string
  preview: string
  gradient: string
  fontClass: string
  animation: string
}[] = [
  {
    id: 1,
    name: 'Minimal Fade',
    description: 'One word, centered, smooth fade',
    preview: 'Dream',
    gradient: 'from-white/90 to-white/60',
    fontClass: 'font-bold text-2xl',
    animation: 'animate-pulse',
  },
  {
    id: 2,
    name: 'Karaoke',
    description: 'Full line, active word highlights',
    preview: 'Tum Hi Ho',
    gradient: 'from-yellow-300 to-yellow-100',
    fontClass: 'font-bold text-lg',
    animation: '',
  },
  {
    id: 3,
    name: 'Word Pop',
    description: 'Big single word, pop-in impact',
    preview: 'LOVE',
    gradient: 'from-purple-400 to-pink-300',
    fontClass: 'font-black text-3xl uppercase tracking-wider',
    animation: '',
  },
  {
    id: 4,
    name: 'Typewriter',
    description: 'Words build up progressively',
    preview: 'Dil se...',
    gradient: 'from-slate-200 to-white',
    fontClass: 'font-bold text-lg tracking-wide',
    animation: '',
  },
  {
    id: 5,
    name: 'Stacked Lines',
    description: 'Layered lines, current is largest',
    preview: 'Lines',
    gradient: 'from-cyan-300 to-cyan-100',
    fontClass: 'font-bold text-xl',
    animation: '',
  },
  {
    id: 6,
    name: 'Cinematic',
    description: 'Clean film subtitle at bottom',
    preview: 'Kal Ho Naa Ho',
    gradient: 'from-amber-200 to-amber-50',
    fontClass: 'font-normal text-base tracking-widest',
    animation: '',
  },
]

export function TextStylePicker({ selectedStyle, onSelectStyle }: TextStylePickerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Text Style
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Choose how lyrics appear in the reel
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {STYLES.map((style) => {
          const isSelected = selectedStyle === style.id

          return (
            <button
              key={style.id}
              onClick={() => onSelectStyle(style.id)}
              className={`
                w-full rounded-xl overflow-hidden transition-all duration-200
                ${isSelected
                  ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20 scale-[1.02]'
                  : 'ring-1 ring-slate-700/50 hover:ring-slate-600'
                }
              `}
            >
              {/* Style thumbnail - 9:16 aspect preview */}
              <div className="relative bg-black aspect-[16/9] flex items-center justify-center overflow-hidden">
                {/* Subtle background effect per style */}
                {style.id === 2 && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/40" />
                )}
                {style.id === 5 && (
                  <>
                    <span className="absolute top-2 text-[8px] text-white/20 font-bold">older line</span>
                    <span className="absolute top-5 text-[10px] text-white/40 font-bold">previous line</span>
                  </>
                )}
                {style.id === 6 && (
                  <div className="absolute bottom-0 left-0 right-0 h-7 bg-black/30" />
                )}

                <span
                  className={`
                    relative z-10 bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent
                    ${style.fontClass} ${style.animation}
                  `}
                >
                  {style.preview}
                </span>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Style number badge */}
                <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-slate-800/80 rounded text-[9px] text-slate-400 flex items-center justify-center font-mono">
                  {style.id}
                </div>
              </div>

              {/* Style info */}
              <div className={`px-3 py-2 text-left ${
                isSelected ? 'bg-purple-500/10' : 'bg-slate-800/50'
              }`}>
                <div className={`text-xs font-medium ${
                  isSelected ? 'text-purple-300' : 'text-slate-300'
                }`}>
                  {style.name}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {style.description}
                </div>
              </div>
            </button>
          )
        })}

        {/* Info note */}
        <div className="pt-2 px-1">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Each style generates FFmpeg filters for the final render.
            Preview shows an approximation of the final look.
          </p>
        </div>
      </div>
    </div>
  )
}
