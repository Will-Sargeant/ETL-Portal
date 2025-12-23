import type { LoadStrategy } from './etl-job'

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  default?: string
}

export interface TableSchema {
  schema_name: string
  table_name: string
  columns: TableColumn[]
}

export interface DestinationConfig {
  credentialId: number
  schema: string
  tableName: string
  loadStrategy: LoadStrategy
  upsertKeys?: string[]
  createNewTable?: boolean
  newTableDDL?: string
}
