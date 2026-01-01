import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, AuthTokens } from '@/types/auth'
import { setupApiAuth } from '@/lib/api'

interface AuthContextType {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User, tokens: AuthTokens) => void
  logout: () => void
  updateTokens: (tokens: AuthTokens) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_KEY = 'etl-portal-auth'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{ user: User | null; tokens: AuthTokens | null }>(() => {
    const stored = localStorage.getItem(AUTH_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse auth from localStorage:', e)
      }
    }
    return { user: null, tokens: null }
  })

  const login = useCallback((user: User, tokens: AuthTokens) => {
    const newState = { user, tokens }
    setState(newState)
    localStorage.setItem(AUTH_KEY, JSON.stringify(newState))
  }, [])

  const logout = useCallback(() => {
    setState({ user: null, tokens: null })
    localStorage.removeItem(AUTH_KEY)
  }, [])

  const updateTokens = useCallback((tokens: AuthTokens) => {
    setState((prev: { user: User | null; tokens: AuthTokens | null }) => {
      const newState = { ...prev, tokens }
      localStorage.setItem(AUTH_KEY, JSON.stringify(newState))
      return newState
    })
  }, [])

  // Setup API auth callbacks
  useEffect(() => {
    setupApiAuth(
      () => {
        const current = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}')
        return current.tokens?.access_token || null
      },
      () => {
        const current = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}')
        return current.tokens?.refresh_token || null
      },
      updateTokens
    )
  }, [updateTokens])


  return (
    <AuthContext.Provider value={{
      user: state.user,
      tokens: state.tokens,
      isAuthenticated: !!(state.user && state.tokens),
      isLoading: false,
      login,
      logout,
      updateTokens,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
