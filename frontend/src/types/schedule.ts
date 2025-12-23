export interface ScheduleConfig {
  cronExpression: string
  enabled: boolean
}

export interface JobRunResponse {
  id: number
  job_id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  message?: string
  rows_processed?: number
  rows_failed?: number
}
