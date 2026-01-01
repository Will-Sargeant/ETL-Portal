import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authApi } from '@/lib/api/auth'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LocalLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const loginResponse = await authApi.localLogin(email, password)
      login(loginResponse.user, {
        access_token: loginResponse.access_token,
        refresh_token: loginResponse.refresh_token,
        token_type: loginResponse.token_type,
      })
      // Clear all cached queries on login to ensure fresh data for new user
      queryClient.clear()
      toast.success('Successfully logged in!')
      navigate('/')
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to login'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
      <div className="mt-4 p-3 bg-muted/30 rounded-md">
        <p className="text-xs text-muted-foreground font-medium mb-1">Test Accounts:</p>
        <p className="text-xs text-muted-foreground">Admin: admin@test.com / admin123</p>
        <p className="text-xs text-muted-foreground">User: user@test.com / user123</p>
      </div>
    </form>
  )
}
