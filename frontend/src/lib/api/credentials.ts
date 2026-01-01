import { apiClient } from '../api'
import type {
  Credential,
  CredentialCreate,
  CredentialUpdate,
  ConnectionTestRequest,
  ConnectionTestResponse,
  TableListResponse,
} from '@/types/credential'
import type { TableSchema } from '@/types/destination'
import type { ColumnMappingConfig } from '@/types/source'

export const credentialsApi = {
  create: async (data: CredentialCreate): Promise<Credential> => {
    const response = await apiClient.post<Credential>('/credentials', data)
    return response.data
  },

  list: async (): Promise<Credential[]> => {
    const response = await apiClient.get<Credential[]>('/credentials')
    return response.data
  },

  get: async (id: number): Promise<Credential> => {
    const response = await apiClient.get<Credential>(`/credentials/${id}`)
    return response.data
  },

  update: async (id: number, data: CredentialUpdate): Promise<Credential> => {
    const response = await apiClient.put<Credential>(`/credentials/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/credentials/${id}`)
  },
}

export const destinationsApi = {
  testConnection: async (
    data: ConnectionTestRequest
  ): Promise<ConnectionTestResponse> => {
    const response = await apiClient.post<ConnectionTestResponse>(
      '/destinations/test',
      data
    )
    return response.data
  },

  testSavedCredential: async (id: number): Promise<ConnectionTestResponse> => {
    const response = await apiClient.post<ConnectionTestResponse>(
      `/destinations/test-credential/${id}`
    )
    return response.data
  },

  listTables: async (credentialId: number): Promise<TableListResponse> => {
    const response = await apiClient.get<TableListResponse>(
      `/destinations/tables/${credentialId}`
    )
    return response.data
  },

  getTableSchema: async (
    credentialId: number,
    schema: string,
    table: string
  ): Promise<TableSchema> => {
    const response = await apiClient.get<TableSchema>(
      `/destinations/tables/${credentialId}/${schema}/${table}/schema`
    )
    return response.data
  },

  generateDDL: async (
    schema: string,
    table: string,
    columns: ColumnMappingConfig[],
    dbType: 'postgresql' | 'redshift'
  ): Promise<{ ddl: string }> => {
    // Filter to only CSV-sourced columns (exclude table-only calculated columns)
    // and convert from camelCase to snake_case
    const csvColumns = columns
      .filter(col => col.sourceColumn && col.sourceColumn.trim() !== '' && !col.exclude)
      .map(col => ({
        source_column: col.sourceColumn,
        destination_column: col.destinationColumn || col.sourceColumn,
        source_type: col.sourceType,
        destination_type: col.destinationType || col.sourceType,
        transformation: col.transformation,
        transformations: col.transformations,
        is_nullable: col.isNullable,
        default_value: col.defaultValue,
        exclude: col.exclude || false,
        is_calculated: col.isCalculated || false,
        expression: col.expression,
        column_order: col.columnOrder || 0,
        is_primary_key: col.isPrimaryKey || false,
      }))

    const response = await apiClient.post<{ ddl: string }>(
      '/destinations/generate-ddl',
      {
        schema,
        table,
        columns: csvColumns,
        db_type: dbType,
      }
    )
    return response.data
  },
}
