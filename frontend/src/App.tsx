import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Database, Upload, Workflow } from 'lucide-react'
import { CSVUploadPage } from './pages/CSVUploadPage'
import { CredentialsPage } from './pages/CredentialsPage'
import { ETLJobsPage } from './pages/ETLJobsPage'
import { JobDetailsPage } from './pages/JobDetailsPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <nav className="border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-6 h-16">
              <Link to="/" className="font-bold text-xl">
                ETL Portal
              </Link>
              <div className="flex gap-4">
                <Link
                  to="/"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  CSV Upload
                </Link>
                <Link
                  to="/credentials"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Credentials
                </Link>
                <Link
                  to="/jobs"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Workflow className="w-4 h-4" />
                  ETL Jobs
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<CSVUploadPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/jobs" element={<ETLJobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  )
}

export default App
