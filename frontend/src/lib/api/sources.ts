import { apiClient } from '../api'
import type { UploadResponse, DataPreview, FileMetadata } from '@/types/source'

export const sourcesApi = {
  uploadCSV: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<UploadResponse>(
      '/sources/csv/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return response.data
  },

  getPreview: async (fileId: string, limit?: number): Promise<DataPreview> => {
    const response = await apiClient.get<DataPreview>(
      `/sources/csv/${fileId}/preview`,
      {
        params: { limit },
      }
    )

    return response.data
  },

  getMetadata: async (fileId: string): Promise<FileMetadata> => {
    const response = await apiClient.get<FileMetadata>(
      `/sources/csv/${fileId}/metadata`
    )

    return response.data
  },

  deleteFile: async (fileId: string): Promise<void> => {
    await apiClient.delete(`/sources/csv/${fileId}`)
  },
}