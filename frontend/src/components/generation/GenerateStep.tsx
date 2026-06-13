import { useState, useCallback, useEffect } from 'react'
import { generateReels, listReels } from '../../api/generationApi'
import { toast } from '../../store/toastStore'
import type { ReelStatusItem, GenerateBatchResponse } from '../../api/generationApi'
import { ProgressView } from './ProgressView'
import { ReelGrid } from './ReelGrid'

type GeneratePhase = 'ready' | 'generating' | 'complete'

interface GenerateStepProps {
  projectId: string
  onBack: () => void
}

export function GenerateStep({ projectId, onBack }: GenerateStepProps) {
  const [phase, setPhase] = useState<GeneratePhase>('ready')
  const [batchData, setBatchData] = useState<GenerateBatchResponse | null>(null)
  const [completedReels, setCompletedReels] = useState<ReelStatusItem[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingBatch, setExistingBatch] = useState<number | null>(null)
  const [isCheckingExisting, setIsCheckingExisting] = useState(true)

  // Check for existing reels on mount
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const result = await listReels(projectId)
        if (result.reels.length > 0) {
          // Find the latest batch
          const latestBatch = Math.max(...result.reels.map(r => r.batch_number))
          const latestReels = result.reels.filter(r => r.batch_number === latestBatch)
          const allDone = latestReels.every(r => r.render_status === 'complete' || r.render_status === 'failed')

          if (allDone) {
            // Show completed results
            setExistingBatch(latestBatch)
            setCompletedReels(latestReels)
            setPhase('complete')
          } else {
            // Resume polling
            setBatchData({
              batch_number: latestBatch,
              reel_ids: latestReels.map(r => r.reel_id),
              job_ids: [],
              total: latestReels.length,
              message: 'Resuming generation tracking...',
            })
            setPhase('generating')
          }
        }
      } catch {
        // No existing reels, that's fine
      } finally {
        setIsCheckingExisting(false)
      }
    }

    checkExisting()
  }, [projectId])

  const handleGenerate = useCallback(async () => {
    setIsStarting(true)
    setError(null)

    try {
      const result = await generateReels(projectId)
      setBatchData(result)
      setPhase('generating')
      toast.info(`Batch ${result.batch_number}: ${result.total} reels queued for rendering`)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err instanceof Error ? err.message : 'Failed to start generation')
      setError(message)
      toast.error(message)
    } finally {
      setIsStarting(false)
    }
  }, [projectId])

  const handleAllComplete = useCallback((reels: ReelStatusItem[]) => {
    setCompletedReels(reels)
    setPhase('complete')
    const completed = reels.filter(r => r.render_status === 'complete').length
    const failed = reels.filter(r => r.render_status === 'failed').length
    if (failed > 0) {
      toast.warning(`Generation complete: ${completed} succeeded, ${failed} failed`)
    } else {
      toast.success(`All ${completed} reels generated successfully!`)
    }
  }, [])

  const handleRegenerate = useCallback(async () => {
    setPhase('ready')
    setBatchData(null)
    setCompletedReels([])
    setExistingBatch(null)
    setError(null)
  }, [])

  // Show loading state while checking for existing reels
  if (isCheckingExisting) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Generate Reels</h2>
          <p className="text-slate-400 text-sm">Checking for existing reels...</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 flex justify-center">
          <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Generate Reels</h2>
        <p className="text-slate-400 text-sm">
          {phase === 'ready' && 'Create 6 unique reels with different text styles. Each reel gets a different look.'}
          {phase === 'generating' && 'Your reels are being rendered. This usually takes 1-2 minutes.'}
          {phase === 'complete' && 'Your reels are ready! Preview them below or download them all.'}
        </p>
      </div>

      {/* Phase: Ready - Start generation */}
      {phase === 'ready' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 sm:p-8">
          <div className="text-center space-y-6">
            {/* Intro graphic */}
            <div className="flex justify-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-10 h-16 sm:w-12 sm:h-20 rounded-lg bg-gradient-to-b from-purple-600/30 to-purple-900/20 border border-purple-500/20 flex items-center justify-center"
                >
                  <span className="text-[10px] font-bold text-purple-300/60">{i}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Ready to Generate 6 Reels
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Each reel will use a different text animation style with your lyrics synced to the audio.
                The render process typically takes 30-90 seconds per reel.
              </p>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isStarting}
              className="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-purple-600 to-purple-500
                hover:from-purple-500 hover:to-purple-400
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white shadow-lg shadow-purple-600/25
                transition-all duration-200"
            >
              {isStarting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting Generation...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  Generate 6 Reels
                </>
              )}
            </button>

            {/* Error display */}
            {error && (
              <div className="max-w-md mx-auto bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase: Generating - Show progress */}
      {phase === 'generating' && batchData && (
        <ProgressView
          projectId={projectId}
          batchNumber={batchData.batch_number}
          jobIds={batchData.job_ids}
          onAllComplete={handleAllComplete}
        />
      )}

      {/* Phase: Complete - Show results grid */}
      {phase === 'complete' && completedReels.length > 0 && (
        <ReelGrid
          projectId={projectId}
          reels={completedReels}
          batchNumber={batchData?.batch_number || existingBatch || 1}
          onRegenerate={handleRegenerate}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          Back to Visual
        </button>
      </div>
    </div>
  )
}
