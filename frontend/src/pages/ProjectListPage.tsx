import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, deleteProject } from '../api/projectsApi'
import { Modal } from '../components/shared/Modal'
import { toast } from '../store/toastStore'
import type { Project } from '../types'

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listProjects()
      setProjects(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load projects'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    const { id, name } = deleteTarget
    setDeleteTarget(null)
    setDeletingId(id)

    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success(`"${name}" deleted successfully`)
    } catch {
      toast.error('Failed to delete project. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-600/30 text-slate-300',
    transcribed: 'bg-blue-600/20 text-blue-300',
    vibe_set: 'bg-purple-600/20 text-purple-300',
    generating: 'bg-amber-600/20 text-amber-300',
    complete: 'bg-green-600/20 text-green-300',
  }

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    transcribed: 'Transcribed',
    vibe_set: 'Vibe Set',
    generating: 'Generating',
    complete: 'Complete',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Doles Reels Generator</h1>
          <p className="text-slate-400 text-sm mt-1">Create Instagram reels with synced lyrics</p>
        </div>
        <Link
          to="/projects/new"
          className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-48 bg-slate-700/60 rounded" />
                    <div className="h-5 w-16 bg-slate-700/40 rounded-full" />
                  </div>
                  <div className="h-3.5 w-32 bg-slate-700/30 rounded mt-2" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-16 bg-slate-700/30 rounded-lg" />
                  <div className="h-9 w-9 bg-slate-700/20 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-red-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchProjects}
            className="text-sm text-slate-300 hover:text-white underline transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && projects.length === 0 && (
        <div className="text-center py-16 sm:py-20">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <p className="text-lg text-slate-300">No projects yet</p>
          <p className="mt-2 text-slate-500">Create your first project to get started.</p>
          <Link
            to="/projects/new"
            className="inline-block mt-6 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create First Project
          </Link>
        </div>
      )}

      {/* Project List */}
      {!isLoading && projects.length > 0 && (
        <div className="grid gap-3 sm:gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 sm:p-5 hover:bg-slate-800/50 hover:border-slate-600/50 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  to={`/projects/${project.id}/flow`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-base sm:text-lg font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                      {project.name}
                    </h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[project.status] || statusColors.draft}`}>
                      {statusLabels[project.status] || project.status}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Created {formatDate(project.created_at)}
                    {project.language && (
                      <span className="ml-2">
                        {project.language === 'hi_dev' ? 'Hindi (Devanagari)' :
                         project.language === 'hi_rom' ? 'Hindi (Roman)' : 'English'}
                      </span>
                    )}
                  </p>
                </Link>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    to={`/projects/${project.id}/flow`}
                    className="hidden sm:flex px-4 py-2 text-sm rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-colors"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleDeleteClick(project.id, project.name)}
                    disabled={deletingId === project.id}
                    className="px-2.5 sm:px-3 py-2 text-sm rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    aria-label={`Delete ${project.name}`}
                  >
                    {deletingId === project.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">"{deleteTarget?.name}"</span>?
          </p>
          <p className="text-sm text-slate-400">
            This will permanently remove the project and all associated data including audio files,
            lyrics, clip pools, and generated reels. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete Project
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
