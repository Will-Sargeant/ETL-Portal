import type { JobRunResponse } from '@/types/schedule'
import { apiClient } from '../api'

export interface JobRunFilters {
  job_id?: number
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled' | 'paused'
  skip?: number
  limit?: number
}

export interface JobRunLogs {
  job_run_id: number
  logs: string
  error_message: string | null
  status: string
}

export const jobRunsApi = {
  /**
   * List job runs with optional filtering
   */
  async list(filters?: JobRunFilters): Promise<JobRunResponse[]> {
    const response = await apiClient.get('/job-runs/', { params: filters })
    return response.data
  },

  /**
   * Get a specific job run by ID
   */
  async get(jobRunId: number): Promise<JobRunResponse> {
    const response = await apiClient.get(`/job-runs/${jobRunId}`)
    return response.data
  },

  /**
   * Get execution logs for a job run
   */
  async getLogs(jobRunId: number): Promise<JobRunLogs> {
    const response = await apiClient.get(`/job-runs/${jobRunId}/logs`)
    return response.data
  },

  /**
   * Delete a job run record
   */
  async delete(jobRunId: number): Promise<void> {
    await apiClient.delete(`/job-runs/${jobRunId}`)
  },
}
