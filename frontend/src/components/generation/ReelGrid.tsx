import { ReelCard } from './ReelCard'
import { getDownloadZipUrl } from '../../api/generationApi'
import { toast } from '../../store/toastStore'
import type { ReelStatusItem } from '../../api/generationApi'

interface ReelGridProps {
  projectId: string
  reels: ReelStatusItem[]
  batchNumber: number
  onRegenerate?: () => void
}

export function ReelGrid({ projectId, reels, batchNumber, onRegenerate }: ReelGridProps) {
  const completedCount = reels.filter(r => r.render_status === 'complete').length
  const failedCount = reels.filter(r => r.render_status === 'failed').length

  const handleDownloadZip = () => {
    if (completedCount === 0) {
      toast.warning('No completed reels to download')
      return
    }
    // Open the zip download URL in a new tab (will trigger file download)
    toast.info('Preparing zip download...')
    window.open(getDownloadZipUrl(projectId), '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold">Reels Ready</h3>
            <p className="text-sm text-slate-400">
              Batch {batchNumber} - {completedCount} of {reels.length} completed
              {failedCount > 0 && <span className="text-red-400"> ({failedCount} failed)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Regenerate button */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium
                transition-colors flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Regenerate
            </button>
          )}

          {/* Download All as Zip */}
          {completedCount > 0 && (
            <button
              onClick={handleDownloadZip}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg
                bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium
                transition-colors flex-1 sm:flex-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              Download All (.zip)
            </button>
          )}
        </div>
      </div>

      {/* Reel cards grid: responsive 1-2-3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {reels.map((reel) => (
          <ReelCard key={reel.reel_id} reel={reel} />
        ))}
      </div>
    </div>
  )
}
