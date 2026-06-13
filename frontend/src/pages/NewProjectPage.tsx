import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createProject } from '../api/projectsApi'
import { toast } from '../store/toastStore'

const MAX_NAME_LENGTH = 100

export function NewProjectPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const charCount = trimmedName.length
  const isOverLimit = charCount > MAX_NAME_LENGTH

  const handleNameChange = (value: string) => {
    setName(value)
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!trimmedName) {
      setError('Please enter a project name')
      return
    }

    if (isOverLimit) {
      setError(`Name must be ${MAX_NAME_LENGTH} characters or less`)
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const project = await createProject(trimmedName)
      toast.success(`Project "${trimmedName}" created!`)
      navigate(`/projects/${project.id}/flow`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      const apiMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(apiMessage || message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Projects
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Create New Project</h1>
      <p className="text-slate-400 text-sm mb-8">
        Give your reel project a memorable name. You can always change it later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-slate-300 mb-2">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Dil Ko Karaar Aaya - Reel"
            maxLength={MAX_NAME_LENGTH + 10}
            className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-500
              focus:outline-none focus:ring-2 focus:border-transparent transition-colors
              ${isOverLimit ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'}`}
            autoFocus
            disabled={isCreating}
          />
          {/* Character counter */}
          <div className="flex justify-between mt-1.5">
            <div className="h-4" /> {/* Spacer for alignment */}
            <span className={`text-xs ${isOverLimit ? 'text-red-400' : charCount > MAX_NAME_LENGTH * 0.8 ? 'text-amber-400' : 'text-slate-500'}`}>
              {charCount}/{MAX_NAME_LENGTH}
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating || !trimmedName || isOverLimit}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </>
          ) : (
            'Create Project'
          )}
        </button>
      </form>
    </div>
  )
}
