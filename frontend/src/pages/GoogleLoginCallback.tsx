import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authApi } from '@/lib/api/auth'
import { useAuth } from '@/contexts/AuthContext'

export function GoogleLoginCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { login } = useAuth()
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasProcessed.current) {
      return
    }

    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        toast.error(`Google authentication failed: ${error}`)
        navigate('/login')
        return
      }

      if (!code) {
        toast.error('No authorization code received')
        navigate('/login')
        return
      }

      hasProcessed.current = true

      try {
        const loginResponse = await authApi.googleLogin(code)
        login(loginResponse.user, {
          access_token: loginResponse.access_token,
          refresh_token: loginResponse.refresh_token,
          token_type: loginResponse.token_type,
        })
        queryClient.clear()
        toast.success('Successfully logged in with Google!')
        navigate('/')
      } catch (error: any) {
        const message = error.response?.data?.detail || 'Failed to login with Google'
        toast.error(message)
        navigate('/login')
        hasProcessed.current = false // Allow retry on error
      }
    }

    handleCallback()
  }, [searchParams, navigate, login, queryClient])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-lg font-medium">Completing sign in...</p>
        <p className="text-sm text-muted-foreground">Please wait while we authenticate your account</p>
      </div>
    </div>
  )
}
