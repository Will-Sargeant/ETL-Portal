import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token management - will be set by AuthContext
if (!globalThis.__apiAuthState) {
  globalThis.__apiAuthState = {
    authTokenGetter: null,
    authTokenUpdater: null,
    refreshTokenGetter: null,
    isSetup: false,
  }
}

export const setupApiAuth = (
  getAccessToken: () => string | null,
  getRefreshToken: () => string | null,
  updateTokens: (tokens: { access_token: string; refresh_token: string; token_type: string }) => void
) => {
  // Always update the callbacks to get fresh closures with current state
  globalThis.__apiAuthState.authTokenGetter = getAccessToken
  globalThis.__apiAuthState.refreshTokenGetter = getRefreshToken
  globalThis.__apiAuthState.authTokenUpdater = updateTokens

  // Only set up interceptors once
  if (globalThis.__apiAuthState.isSetup) {
    return
  }

  globalThis.__apiAuthState.isSetup = true
}

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const getter = globalThis.__apiAuthState?.authTokenGetter
    if (getter) {
      const token = getter()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Shared refresh promise to prevent duplicate refresh attempts
let refreshPromise: Promise<any> | null = null

// Custom error class for auth failures
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

// Response interceptor for handling 401 and refreshing tokens
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshTokenGetter = globalThis.__apiAuthState?.refreshTokenGetter
      const authTokenUpdater = globalThis.__apiAuthState?.authTokenUpdater
      const refreshToken = refreshTokenGetter?.()

      if (refreshToken && authTokenUpdater) {
        // If refresh is already in progress, wait for it
        if (refreshPromise) {
          try {
            await refreshPromise
            const newToken = refreshTokenGetter?.()
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return apiClient(originalRequest)
            }
          } catch (refreshError) {
            throw new AuthenticationError('Token refresh failed')
          }
        }

        // Start a new refresh attempt
        refreshPromise = axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        })
          .then((response) => {
            const { access_token, refresh_token: new_refresh_token } = response.data

            authTokenUpdater({
              access_token,
              refresh_token: new_refresh_token,
              token_type: 'bearer',
            })

            refreshPromise = null
            return response
          })
          .catch((refreshError) => {
            refreshPromise = null
            throw refreshError
          })

        try {
          await refreshPromise
          const newToken = refreshTokenGetter?.()
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return apiClient(originalRequest)
          }
        } catch (refreshError) {
          throw new AuthenticationError('Token refresh failed')
        }
      } else {
        throw new AuthenticationError('No refresh token available')
      }
    }

    return Promise.reject(error)
  }
)

// Export AuthenticationError for UI layer to handle
export { AuthenticationError }
