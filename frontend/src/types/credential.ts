export type DatabaseType = 'postgresql' | 'redshift'

export interface CredentialCreate {
  name: string
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl_mode?: string
}

export interface CredentialUpdate {
  name?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl_mode?: string
}

export interface Credential {
  id: number
  name: string
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  ssl_mode?: string
  created_at: string
  updated_at: string
}

export interface ConnectionTestRequest {
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl_mode?: string
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
  server_version?: string
  connection_time_ms?: number
}

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  default?: string
}

export interface TableInfo {
  schema_name: string
  name: string
  row_count?: number
  column_count: number
  columns: TableColumn[]
}

export interface TableListResponse {
  tables: TableInfo[]
}
