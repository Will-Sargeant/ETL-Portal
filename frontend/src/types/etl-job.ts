export type JobStatus =
  | 'draft'
  | 'active'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'

export type SourceType = 'csv' | 'google_sheets'

export type DestinationType = 'postgresql' | 'redshift'

export type LoadStrategy = 'insert' | 'upsert' | 'truncate_insert'

export interface ColumnMapping {
  id?: number
  job_id?: number
  source_column: string
  destination_column: string
  source_type: string
  destination_type: string
  transformation?: string
  is_nullable: boolean
  default_value?: string
  exclude?: boolean
  is_calculated?: boolean
  expression?: string
  column_order?: number
  is_primary_key?: boolean
}

export interface ScheduleCreate {
  cron_expression: string
  enabled: boolean
}

export interface ETLJobCreate {
  name: string
  description?: string
  source_type: SourceType
  source_config: Record<string, any>
  destination_type: DestinationType
  destination_config: Record<string, any>
  load_strategy: LoadStrategy
  upsert_keys?: string[]
  transformation_rules?: Record<string, any>
  batch_size: number
  column_mappings: ColumnMapping[]
  schedule?: ScheduleCreate
  create_new_table?: boolean
  new_table_ddl?: string
}

export interface ETLJobUpdate {
  name?: string
  description?: string
  source_config?: Record<string, any>
  destination_config?: Record<string, any>
  load_strategy?: LoadStrategy
  upsert_keys?: string[]
  transformation_rules?: Record<string, any>
  batch_size?: number
  status?: JobStatus
}

export interface ETLJob {
  id: number
  name: string
  description?: string
  source_type: SourceType
  source_config: Record<string, any>
  destination_type: DestinationType
  destination_config: Record<string, any>
  load_strategy: string
  upsert_keys?: string[]
  transformation_rules?: Record<string, any>
  batch_size: number
  status: JobStatus
  created_at: string
  updated_at: string
  column_mappings: ColumnMapping[]
}

export interface ETLJobListItem {
  id: number
  name: string
  description?: string
  source_type: SourceType
  destination_type: DestinationType
  status: JobStatus
  created_at: string
  updated_at: string
}
