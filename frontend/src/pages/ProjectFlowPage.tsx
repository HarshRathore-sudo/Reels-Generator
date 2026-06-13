import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { useProject } from '../hooks/useProject'
import { useProjectStore } from '../store/projectStore'
import { toast } from '../store/toastStore'
import { AudioUploader } from '../components/audio/AudioUploader'
import { AudioTrimmer } from '../components/audio/AudioTrimmer'
import { TranscriptionProgress } from '../components/audio/TranscriptionProgress'
import { LyricsReviewDashboard } from '../components/lyrics/LyricsReviewDashboard'
import { VibeInput } from '../components/vibe/VibeInput'
import { KeywordEditor } from '../components/vibe/KeywordEditor'
import { setVibe, updateKeywords } from '../api/vibeApi'
import { VisualModeSelector } from '../components/visual/VisualModeSelector'
import { CustomVideoInput } from '../components/visual/CustomVideoInput'
import { ClipPoolGallery } from '../components/visual/ClipPoolGallery'
import { setVisualMode } from '../api/visualApi'
import { GenerateStep } from '../components/generation/GenerateStep'
import type { AudioFile, VisualMode, ClipPoolItem } from '../types'

type FlowStep = 'upload' | 'trim' | 'transcribe' | 'lyrics' | 'vibe' | 'visual' | 'generate'

export function ProjectFlowPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project, audioFile, isLoading, error, refetch } = useProject(id || '')
  const setAudioFile = useProjectStore(s => s.setAudioFile)

  // Local state for the file blob (used by AudioTrimmer to load waveform from local file)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // Determine current flow step based on project state
  const [currentStep, setCurrentStep] = useState<FlowStep>('upload')

  const handleUploadComplete = useCallback((audio: AudioFile, file: File) => {
    setAudioFile(audio)
    setUploadedFile(file)
    toast.success('Audio uploaded successfully!')
    setCurrentStep('trim')
  }, [setAudioFile])

  const handleTrimComplete = useCallback((_audio: AudioFile) => {
    setAudioFile(_audio)
    toast.success('Audio trimmed to 30 seconds')
    setCurrentStep('transcribe')
  }, [setAudioFile])

  const handleTranscriptionComplete = useCallback(() => {
    // Refetch project to get updated status + lyrics
    refetch()
    toast.success('Transcription complete!')
    // Move to lyrics step
    setCurrentStep('lyrics')
  }, [refetch])

  const handleBackToUpload = useCallback(() => {
    setCurrentStep('upload')
    setUploadedFile(null)
  }, [])

  const handleLyricsComplete = useCallback(() => {
    refetch()
    setCurrentStep('vibe')
  }, [refetch])

  const handleVibeComplete = useCallback(() => {
    refetch()
    setCurrentStep('visual')
  }, [refetch])

  const handleBackToLyrics = useCallback(() => {
    setCurrentStep('lyrics')
  }, [])

  const handleVisualComplete = useCallback(() => {
    refetch()
    setCurrentStep('generate')
  }, [refetch])

  const handleBackToVibe = useCallback(() => {
    setCurrentStep('vibe')
  }, [])

  const handleBackToTranscribe = useCallback(() => {
    setCurrentStep('transcribe')
  }, [])

  const handleBackToTrim = useCallback(() => {
    setCurrentStep('trim')
  }, [])

  // Auto-detect step from project status on load
  useEffect(() => {
    if (!project) return
    if (project.status === 'transcribed' && currentStep === 'upload') {
      setCurrentStep('lyrics')
    } else if (project.status === 'vibe_set' && currentStep === 'upload') {
      setCurrentStep('visual')
    } else if ((project.status === 'generating' || project.status === 'complete') && currentStep === 'upload') {
      setCurrentStep('generate')
    }
  }, [project, currentStep])

  if (!id) {
    navigate('/')
    return null
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Skeleton header */}
        <div className="flex items-center gap-4 mb-8 animate-pulse">
          <div className="w-5 h-5 rounded bg-slate-700/50" />
          <div>
            <div className="h-6 w-48 bg-slate-700/60 rounded mb-2" />
            <div className="h-3.5 w-24 bg-slate-700/30 rounded" />
          </div>
        </div>
        {/* Skeleton step indicator */}
        <div className="flex items-center gap-1 mb-8 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="flex items-center">
              {i > 1 && <div className="w-6 h-px bg-slate-700/40 mx-1" />}
              <div className="h-7 w-16 bg-slate-700/30 rounded-full" />
            </div>
          ))}
        </div>
        {/* Skeleton content */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 animate-pulse">
          <div className="h-5 w-36 bg-slate-700/60 rounded mb-3" />
          <div className="h-3.5 w-64 bg-slate-700/30 rounded mb-6" />
          <div className="h-40 bg-slate-700/20 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Project not found</h2>
          <p className="text-slate-400 mb-6">{error || 'This project does not exist or may have been deleted.'}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  // Use the store audioFile or the one we just uploaded
  const activeAudioFile = audioFile

  const isWideStep = currentStep === 'lyrics' || currentStep === 'generate'

  return (
    <div className={`mx-auto px-4 sm:px-6 py-6 sm:py-8 ${isWideStep ? 'max-w-7xl' : 'max-w-4xl'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link
          to="/"
          className="text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Back to projects"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{project.name}</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {project.status === 'draft' ? 'Getting started' : project.status.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <StepIndicator currentStep={currentStep} />

      {/* Flow Content */}
      <div className="mt-6 sm:mt-8">
        {/* STEP: Upload */}
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Upload Audio</h2>
              <p className="text-slate-400 text-sm">
                Upload the song you want to create a reel for. We support most audio formats.
              </p>
            </div>

            <AudioUploader
              projectId={id}
              onUploadComplete={handleUploadComplete}
            />

            {activeAudioFile && (
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                <p className="text-sm text-slate-400">
                  Current audio: <span className="text-slate-200">{activeAudioFile.original_url.split('/').pop()}</span>
                  {' '}({formatDuration(activeAudioFile.duration_seconds)})
                </p>
                <p className="text-xs text-slate-500 mt-1">Upload a new file to replace it.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Trim */}
        {currentStep === 'trim' && activeAudioFile && (
          <AudioTrimStep
            projectId={id}
            audioFile={activeAudioFile}
            audioSrc={uploadedFile}
            onTrimComplete={handleTrimComplete}
            onBack={handleBackToUpload}
          />
        )}

        {/* STEP: Transcribe */}
        {currentStep === 'transcribe' && (
          <TranscriptionProgress
            projectId={id}
            defaultLanguage={project.language}
            onTranscriptionComplete={handleTranscriptionComplete}
            onBack={handleBackToTrim}
          />
        )}

        {/* STEP: Lyrics Review Dashboard */}
        {currentStep === 'lyrics' && (
          <LyricsReviewDashboard
            projectId={id}
            onComplete={handleLyricsComplete}
            onBack={handleBackToTranscribe}
          />
        )}

        {/* STEP: Vibe — Set vibe description + keywords */}
        {currentStep === 'vibe' && (
          <VibeStep
            projectId={id}
            initialVibe={project.vibe_description || ''}
            initialKeywords={project.vibe_keywords || []}
            onComplete={handleVibeComplete}
            onBack={handleBackToLyrics}
          />
        )}

        {/* STEP: Visual — Mode selection + clip pool */}
        {currentStep === 'visual' && (
          <VisualStep
            projectId={id}
            initialMode={project.visual_mode}
            initialCustomUrl={project.custom_video_url || ''}
            keywords={project.vibe_keywords || []}
            onComplete={handleVisualComplete}
            onBack={handleBackToVibe}
          />
        )}

        {/* STEP: Generate */}
        {currentStep === 'generate' && (
          <GenerateStep
            projectId={id}
            onBack={handleBackToVibe}
          />
        )}
      </div>
    </div>
  )
}


// ─── Step Indicator ───────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: FlowStep
}

const STEPS: { key: FlowStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'trim', label: 'Trim' },
  { key: 'transcribe', label: 'Transcribe' },
  { key: 'lyrics', label: 'Lyrics' },
  { key: 'vibe', label: 'Vibe' },
  { key: 'visual', label: 'Visual' },
  { key: 'generate', label: 'Generate' },
]

function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep
        const isCompleted = i < currentIndex
        const isFuture = i > currentIndex

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-3 sm:w-6 h-px mx-0.5 sm:mx-1 ${isCompleted ? 'bg-purple-500' : 'bg-slate-700'}`} />
            )}
            <div
              className={`
                flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap
                transition-colors
                ${isActive ? 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/30' : ''}
                ${isCompleted ? 'bg-purple-600/10 text-purple-400' : ''}
                ${isFuture ? 'text-slate-600' : ''}
              `}
            >
              {isCompleted && (
                <svg className="w-2.5 sm:w-3 h-2.5 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {step.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ─── Trim Step ────────────────────────────────────────────────────

interface AudioTrimStepProps {
  projectId: string
  audioFile: AudioFile
  audioSrc: File | null
  onTrimComplete: (audio: AudioFile) => void
  onBack: () => void
}

function AudioTrimStep({ projectId, audioFile, audioSrc, onTrimComplete, onBack }: AudioTrimStepProps) {
  const src = audioSrc || audioFile.original_url

  if (audioFile.duration_seconds <= 30) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Audio Ready</h2>
          <p className="text-slate-400 text-sm">
            Your audio is {formatDuration(audioFile.duration_seconds)} - no trimming needed for a 30-second reel.
          </p>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6">
          {audioSrc && (
            <div className="mb-4">
              <AudioPreview file={audioSrc} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {audioFile.original_url.split('/').pop()}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDuration(audioFile.duration_seconds)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={onBack}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
              >
                Replace
              </button>
              <button
                onClick={() => onTrimComplete(audioFile)}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6">
      <AudioTrimmer
        projectId={projectId}
        audioFile={audioFile}
        audioSrc={src}
        onTrimComplete={onTrimComplete}
        onBack={onBack}
      />
    </div>
  )
}


// ─── Vibe Step ───────────────────────────────────────────────────

interface VibeStepProps {
  projectId: string
  initialVibe: string
  initialKeywords: string[]
  onComplete: () => void
  onBack: () => void
}

const MAX_VIBE_LENGTH = 500

function VibeStep({ projectId, initialVibe, initialKeywords, onComplete, onBack }: VibeStepProps) {
  const [vibeText, setVibeText] = useState(initialVibe)
  const [keywords, setKeywords] = useState<string[]>(initialKeywords)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isUpdatingKeywords, setIsUpdatingKeywords] = useState(false)

  const vibeLength = vibeText.trim().length
  const isVibeOverLimit = vibeLength > MAX_VIBE_LENGTH

  const handleSaveVibe = useCallback(async () => {
    if (!vibeText.trim()) return
    if (isVibeOverLimit) {
      setSaveError(`Vibe description must be ${MAX_VIBE_LENGTH} characters or less`)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const result = await setVibe(projectId, vibeText.trim())
      setKeywords(result.keywords)
      setIsSaved(true)
      toast.success('Vibe set and keywords extracted!')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err instanceof Error ? err.message : 'Failed to save vibe')
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }, [projectId, vibeText, isVibeOverLimit])

  const handleKeywordsChange = useCallback(async (newKeywords: string[]) => {
    setKeywords(newKeywords)

    // Auto-save keywords if vibe was already saved
    if (isSaved && newKeywords.length >= 3) {
      setIsUpdatingKeywords(true)
      try {
        const result = await updateKeywords(projectId, newKeywords)
        setKeywords(result.keywords)
      } catch {
        toast.warning('Failed to save keywords. You can try again.')
      } finally {
        setIsUpdatingKeywords(false)
      }
    }
  }, [projectId, isSaved])

  const handleContinue = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Set the Vibe</h2>
        <p className="text-slate-400 text-sm">
          Describe the visual mood and aesthetic for your reel. AI will extract search keywords from your description.
        </p>
      </div>

      {/* Main content card */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-6">
        {/* Vibe input */}
        <div>
          <VibeInput
            projectId={projectId}
            value={vibeText}
            onChange={(v) => { setVibeText(v); setIsSaved(false) }}
            disabled={isSaving}
          />
          {/* Character counter */}
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${isVibeOverLimit ? 'text-red-400' : vibeLength > MAX_VIBE_LENGTH * 0.8 ? 'text-amber-400' : 'text-slate-500'}`}>
              {vibeLength}/{MAX_VIBE_LENGTH}
            </span>
          </div>
        </div>

        {/* Save Vibe button */}
        {!isSaved && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={handleSaveVibe}
              disabled={!vibeText.trim() || isSaving || isVibeOverLimit}
              className="px-5 py-2.5 rounded-xl font-medium text-sm
                bg-purple-600 text-white
                hover:bg-purple-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Set Vibe & Extract Keywords
                </>
              )}
            </button>

            {saveError && (
              <span className="text-red-400 text-sm">{saveError}</span>
            )}
          </div>
        )}

        {/* Keywords section — shown after vibe is saved */}
        {isSaved && keywords.length > 0 && (
          <div className="border-t border-slate-700/50 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-sm text-green-400 font-medium">Vibe set successfully!</span>
              {isUpdatingKeywords && (
                <span className="text-xs text-slate-500 ml-2">Saving keywords...</span>
              )}
            </div>

            <KeywordEditor
              keywords={keywords}
              onChange={handleKeywordsChange}
              disabled={isSaving}
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          Back to Lyrics
        </button>

        {isSaved && keywords.length >= 3 && (
          <button
            type="button"
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-xl font-medium text-sm
              bg-purple-600 text-white hover:bg-purple-500
              transition-all flex items-center gap-2"
          >
            Continue to Visual
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Visual Step ─────────────────────────────────────────────────

interface VisualStepProps {
  projectId: string
  initialMode: VisualMode | null
  initialCustomUrl: string
  keywords: string[]
  onComplete: () => void
  onBack: () => void
}

function VisualStep({
  projectId,
  initialMode,
  initialCustomUrl,
  keywords,
  onComplete,
  onBack,
}: VisualStepProps) {
  const [selectedMode, setSelectedMode] = useState<VisualMode | null>(initialMode)
  const [isSavingMode, setIsSavingMode] = useState(false)
  const [clipPoolReady, setClipPoolReady] = useState(false)
  const [customVideoSaved, setCustomVideoSaved] = useState(!!initialCustomUrl)

  const handleModeSelect = useCallback(async (mode: VisualMode) => {
    setSelectedMode(mode)
    setIsSavingMode(true)
    try {
      await setVisualMode(projectId, mode)
    } catch (err) {
      console.error('Failed to set visual mode:', err)
      toast.error('Failed to save visual mode')
    } finally {
      setIsSavingMode(false)
    }
  }, [projectId])

  const handlePoolReady = useCallback((_clips: ClipPoolItem[]) => {
    setClipPoolReady(true)
  }, [])

  const handleCustomVideoSubmit = useCallback((_url: string) => {
    setCustomVideoSaved(true)
    toast.success('Custom video URL saved')
  }, [])

  const canContinue = (selectedMode === 'stock' && clipPoolReady) ||
    (selectedMode === 'custom' && customVideoSaved)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Choose Visual Style</h2>
        <p className="text-slate-400 text-sm">
          Select how you want the background video for your reel. Use AI-curated stock videos or provide your own.
        </p>
      </div>

      {/* Mode Selector */}
      <VisualModeSelector
        initialMode={selectedMode}
        onSelect={handleModeSelect}
        disabled={isSavingMode}
      />

      {/* Mode-specific content */}
      {selectedMode === 'stock' && (
        <div className="space-y-4">
          <div className="border-t border-slate-700/50 pt-6">
            <ClipPoolGallery
              projectId={projectId}
              keywords={keywords}
              onPoolReady={handlePoolReady}
              disabled={isSavingMode}
            />
          </div>
        </div>
      )}

      {selectedMode === 'custom' && (
        <div className="border-t border-slate-700/50 pt-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Custom Video</h3>
            <CustomVideoInput
              projectId={projectId}
              initialUrl={initialCustomUrl}
              onSubmit={handleCustomVideoSubmit}
              disabled={isSavingMode}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          Back to Vibe
        </button>

        {canContinue && (
          <button
            type="button"
            onClick={onComplete}
            className="px-6 py-2.5 rounded-xl font-medium text-sm
              bg-purple-600 text-white hover:bg-purple-500
              transition-all flex items-center gap-2"
          >
            Continue to Generate
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Audio Preview (simple HTML5 audio player) ───────────────────

function AudioPreview({ file }: { file: File }) {
  const url = URL.createObjectURL(file)

  return (
    <audio
      controls
      className="w-full"
      src={url}
      onLoad={() => URL.revokeObjectURL(url)}
    >
      Your browser does not support the audio element.
    </audio>
  )
}


// ─── Helpers ──────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}
