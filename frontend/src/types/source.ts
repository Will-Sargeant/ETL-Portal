export interface ColumnInfo {
  name: string
  data_type: 'text' | 'number' | 'date' | 'boolean'
  sample_values: any[]
  null_count: number
  unique_count: number | null
  is_nullable: boolean
}

export interface DataPreview {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  total_rows: number
  preview_rows: number
}

export interface UploadResponse {
  file_id: string
  filename: string
  file_size: number
  row_count: number
  column_count: number
  columns: ColumnInfo[]
  preview: DataPreview
  uploaded_at: string
}

export interface FileMetadata {
  file_id: string
  filename: string
  file_path: string
  file_size: number
  row_count: number
  column_count: number
  uploaded_at: string
  columns: ColumnInfo[]
}

export interface ColumnMappingConfig {
  sourceColumn: string
  destinationColumn: string | null
  sourceType: string
  destinationType: string | null
  transformation?: string
  isNullable: boolean
  defaultValue?: string
  exclude?: boolean
  isCalculated?: boolean
  expression?: string
  columnOrder?: number
  isPrimaryKey?: boolean
}

export interface ScheduleConfig {
  cronExpression: string
  enabled: boolean
}

export interface JobConfiguration {
  // Step 1 (Main Page)
  jobName: string
  jobDescription: string

  // Step 2 (Destination & Mappings)
  destination: import('@/types/destination').DestinationConfig | null
  tableSchema: import('@/types/destination').TableSchema | null
  columnMappings: ColumnMappingConfig[]

  // Step 3 (Schedule & Actions)
  schedule: ScheduleConfig | null
  batchSize: number
}