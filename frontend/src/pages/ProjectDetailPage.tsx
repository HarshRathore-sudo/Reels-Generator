import { useParams } from 'react-router-dom'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-4">Project Detail</h1>
      <p className="text-slate-400">Project ID: {id}</p>
      <p className="text-slate-500 mt-4">
        Generated reels grid and project details will be shown here.
      </p>
    </div>
  )
}
