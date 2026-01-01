import { apiClient } from '../api'

export interface Schedule {
  id: number
  job_id: number
  cron_expression: string
  enabled: boolean
  last_run: string | null
  next_run: string | null
  airflow_dag_id: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleCreate {
  cron_expression: string
  enabled: boolean
}

export interface ScheduleUpdate {
  cron_expression?: string
  enabled?: boolean
}

export interface ScheduleFilters {
  job_id?: number
  enabled?: boolean
  skip?: number
  limit?: number
}

export const schedulesApi = {
  /**
   * List schedules with optional filtering
   */
  async list(filters?: ScheduleFilters): Promise<Schedule[]> {
    const response = await apiClient.get('/schedules/', { params: filters })
    return response.data
  },

  /**
   * Get a specific schedule by ID
   */
  async get(scheduleId: number): Promise<Schedule> {
    const response = await apiClient.get(`/schedules/${scheduleId}`)
    return response.data
  },

  /**
   * Create a new schedule for a job
   */
  async create(jobId: number, schedule: ScheduleCreate): Promise<Schedule> {
    const response = await apiClient.post(`/schedules/?job_id=${jobId}`, schedule)
    return response.data
  },

  /**
   * Update a schedule
   */
  async update(scheduleId: number, updates: ScheduleUpdate): Promise<Schedule> {
    const response = await apiClient.put(`/schedules/${scheduleId}`, updates)
    return response.data
  },

  /**
   * Delete a schedule
   */
  async delete(scheduleId: number): Promise<void> {
    await apiClient.delete(`/schedules/${scheduleId}`)
  },

  /**
   * Enable a schedule
   */
  async enable(scheduleId: number): Promise<Schedule> {
    const response = await apiClient.post(`/schedules/${scheduleId}/enable`)
    return response.data
  },

  /**
   * Disable a schedule
   */
  async disable(scheduleId: number): Promise<Schedule> {
    const response = await apiClient.post(`/schedules/${scheduleId}/disable`)
    return response.data
  },
}
