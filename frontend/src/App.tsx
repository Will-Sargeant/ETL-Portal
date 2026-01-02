import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { HomePage } from './pages/HomePage'
import { CredentialsPage } from './pages/CredentialsPage'
import { ETLJobsPage } from './pages/ETLJobsPage'
import { JobDetailsPage } from './pages/JobDetailsPage'
import { JobEditPage } from './pages/JobEditPage'
import { UnifiedJobWizardPage } from './pages/UnifiedJobWizardPage'
import { UsersPage } from './pages/UsersPage'
import { GoogleCallback } from './pages/GoogleCallback'
import { GoogleLoginCallback } from './pages/GoogleLoginCallback'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { MainLayout } from './components/MainLayout'
import { useTheme } from './hooks/useTheme'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  useTheme() // Initialize theme system

  return (
    <AuthProvider>
      <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/auth/google/login" element={<GoogleLoginCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="credentials" element={<CredentialsPage />} />
          <Route path="jobs" element={<ETLJobsPage />} />
          <Route path="jobs/new" element={<UnifiedJobWizardPage />} />
          <Route path="jobs/:jobId" element={<JobDetailsPage />} />
          <Route path="jobs/:jobId/edit" element={<JobEditPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      </Router>
    </AuthProvider>
  )
}

export default App
