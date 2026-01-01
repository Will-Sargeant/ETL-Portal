import { apiClient } from '../api'
import type { User } from '@/types/auth'

export interface UserCreate {
  email: string
  full_name: string
  password: string
  role: 'admin' | 'user'
}

export interface UserRoleUpdate {
  role: 'admin' | 'user'
}

export const usersApi = {
  list: async (includeInactive = false): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users', {
      params: { include_inactive: includeInactive }
    })
    return response.data
  },

  create: async (userData: UserCreate): Promise<User> => {
    const response = await apiClient.post<User>('/users', userData)
    return response.data
  },

  updateRole: async (userId: number, role: 'admin' | 'user'): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${userId}/role`, { role })
    return response.data
  },

  delete: async (userId: number): Promise<void> => {
    await apiClient.delete(`/users/${userId}`)
  },
}
