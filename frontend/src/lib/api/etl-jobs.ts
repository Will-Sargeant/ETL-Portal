import type { ETLJobCreate, ETLJobUpdate, ETLJob, ETLJobListItem, ColumnMapping } from '@/types/etl-job'
import type { JobRunResponse } from '@/types/schedule'
import { apiClient } from '../api'

export const etlJobsApi = {
  /**
   * Create a new ETL job
   */
  async create(job: ETLJobCreate): Promise<ETLJob> {
    const response = await apiClient.post('/jobs/', job)
    return response.data
  },

  /**
   * List all ETL jobs
   */
  async list(params?: { skip?: number; limit?: number; status?: string }): Promise<ETLJobListItem[]> {
    const response = await apiClient.get('/jobs/', { params })
    return response.data
  },

  /**
   * Get jobs by destination table (for auto-populating calculated columns)
   * TODO: Backend endpoint needed - currently fetches all jobs and filters client-side
   */
  async getByDestination(schema: string, tableName: string): Promise<ETLJob[]> {
    // Fetch all jobs (inefficient - should be a dedicated backend endpoint)
    const allJobs = await etlJobsApi.list()

    // Filter to jobs writing to the same destination table
    // destination_config structure: { schema, table, credential_id, ... }
    const matchingJobIds = allJobs
      .filter(job => {
        const destConfig = job.destination_config as any
        return destConfig?.schema === schema && destConfig?.table === tableName
      })
      .map(job => job.id)

    if (matchingJobIds.length === 0) {
      return []
    }

    // Fetch full job details for matching jobs (need column_mappings)
    const fullJobs = await Promise.all(
      matchingJobIds.map(id => etlJobsApi.get(id))
    )

    return fullJobs
  },

  /**
   * Get an ETL job by ID
   */
  async get(jobId: number): Promise<ETLJob> {
    const response = await apiClient.get(`/jobs/${jobId}`)
    return response.data
  },

  /**
   * Update an ETL job
   */
  async update(jobId: number, updates: ETLJobUpdate): Promise<ETLJob> {
    const response = await apiClient.put(`/jobs/${jobId}`, updates)
    return response.data
  },

  /**
   * Delete an ETL job
   */
  async delete(jobId: number): Promise<void> {
    await apiClient.delete(`/jobs/${jobId}`)
  },

  /**
   * Update column mappings for an ETL job
   */
  async updateMappings(jobId: number, mappings: ColumnMapping[]): Promise<ColumnMapping[]> {
    const response = await apiClient.put(`/jobs/${jobId}/mappings`, mappings)
    return response.data
  },

  /**
   * Execute an ETL job immediately
   */
  async execute(jobId: number): Promise<JobRunResponse> {
    const response = await apiClient.post(`/jobs/execute/${jobId}`)
    return response.data
  },

  /**
   * Create and execute an ETL job
   */
  async createAndExecute(job: ETLJobCreate): Promise<{ job: ETLJob; run: JobRunResponse }> {
    // Create job
    const createdJob = await etlJobsApi.create(job)

    // Execute immediately
    const run = await etlJobsApi.execute(createdJob.id)

    return { job: createdJob, run }
  },

  /**
   * Pause an ETL job (blocks all execution)
   */
  async pause(jobId: number): Promise<ETLJob> {
    const response = await apiClient.post(`/jobs/${jobId}/pause`)
    return response.data
  },

  /**
   * Resume a paused ETL job
   */
  async resume(jobId: number): Promise<ETLJob> {
    const response = await apiClient.post(`/jobs/${jobId}/resume`)
    return response.data
  },
}
