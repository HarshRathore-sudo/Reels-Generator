import { Link } from 'react-router-dom'
import type { Project } from '../../types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-purple-500 transition-colors"
    >
      <h3 className="text-lg font-semibold text-white mb-2">{project.name}</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400 capitalize">{project.status}</span>
        <span className="text-sm text-slate-500">
          {new Date(project.created_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}
