import { Routes, Route } from 'react-router-dom'
import { ProjectListPage } from './pages/ProjectListPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { ProjectFlowPage } from './pages/ProjectFlowPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ToastContainer } from './components/shared/Toast'

export function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <Routes>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:id/flow" element={<ProjectFlowPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  )
}
