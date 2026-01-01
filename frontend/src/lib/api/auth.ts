import { apiClient } from '../api'
import type { LoginResponse } from '@/types/auth'

export const authApi = {
  localLogin: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/local/login', { email, password })
    return response.data
  },

  googleLogin: async (code: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/google/login', { code })
    return response.data
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
    return response.data
  },

  logout: async (refreshToken: string) => {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },
}
