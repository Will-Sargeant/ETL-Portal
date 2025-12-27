import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Loader2, Info } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { credentialsApi, destinationsApi } from '@/lib/api/credentials'
import type { DestinationConfig, TableSchema } from '@/types/destination'
import type { ColumnMappingConfig } from '@/types/source'

interface DestinationSelectorProps {
  value: DestinationConfig | null
  onChange: (config: DestinationConfig) => void
  onTableSchemaFetched: (schema: TableSchema) => void
  columnMappings: ColumnMappingConfig[]
  disableNewTable?: boolean
}

export function DestinationSelector({
  value,
  onChange,
  onTableSchemaFetched,
  columnMappings,
  disableNewTable = false,
}: DestinationSelectorProps) {
  const [tableMode, setTableMode] = useState<'existing' | 'new'>('existing')
  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables', value?.credentialId],
    queryFn: () => destinationsApi.listTables(value!.credentialId),
    enabled: !!value?.credentialId,
  })

  const schemaQueryEnabled = !!(
    value?.credentialId &&
    value?.schema &&
    value?.tableName &&
    !value?.createNewTable &&
    tableMode === 'existing' // Only fetch schema for existing tables
  )

  const { data: tableSchema, isLoading: schemaLoading, error: schemaError } = useQuery({
    queryKey: ['table-schema', value?.credentialId, value?.schema, value?.tableName],
    queryFn: () => {
      return destinationsApi.getTableSchema(
        value!.credentialId,
        value!.schema,
        value!.tableName
      )
    },
    enabled: schemaQueryEnabled,
    retry: false, // Don't retry if table doesn't exist
  })

  // Call onTableSchemaFetched when schema data is available
  useEffect(() => {
    if (tableSchema) {
      onTableSchemaFetched(tableSchema)
    }
  }, [tableSchema, onTableSchemaFetched])

  const selectedCredential = credentials?.find((c) => c.id === value?.credentialId)

  const handleCredentialChange = (credentialId: string) => {
    onChange({
      credentialId: parseInt(credentialId),
      schema: 'public',
      tableName: '',
      loadStrategy: 'insert',
      createNewTable: false,
    })
    setTableMode('existing')
  }

  const handleTableChange = (tableKey: string) => {
    // Format: schema.table_name
    const [schema, tableName] = tableKey.split('.')
    onChange({
      ...value!,
      schema,
      tableName,
      createNewTable: false,
    })
  }

  const handleTableModeChange = (mode: 'existing' | 'new') => {
    setTableMode(mode)
    onChange({
      ...value!,
      tableName: '',
      createNewTable: mode === 'new',
      newTableDDL: undefined,
    })
  }

  const handleNewTableNameChange = (name: string) => {
    onChange({
      ...value!,
      tableName: name,
      createNewTable: true,
    })
  }

  const handleNewTableSchemaChange = (schema: string) => {
    onChange({
      ...value!,
      schema,
      createNewTable: true,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="credential">Database Credential *</Label>
        {credentialsLoading ? (
          <div className="flex items-center gap-2 p-3 border rounded-md">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading credentials...</span>
          </div>
        ) : credentials && credentials.length > 0 ? (
          <Select
            value={value?.credentialId?.toString() || ''}
            onValueChange={handleCredentialChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a credential" />
            </SelectTrigger>
            <SelectContent>
              {credentials.map((credential) => (
                <SelectItem key={credential.id} value={credential.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    {credential.name} ({credential.db_type})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="p-4 border rounded-md bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No credentials found. Please create a credential first on the Credentials page.
            </p>
          </div>
        )}
      </div>

      {selectedCredential && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">{selectedCredential.name}</p>
              <p className="text-muted-foreground">
                {selectedCredential.username}@{selectedCredential.host}:
                {selectedCredential.port}/{selectedCredential.database}
              </p>
            </div>
          </div>
        </div>
      )}

      {value?.credentialId && (
        <>
          <div className="space-y-3">
            <Label>Table Selection Mode *</Label>
            <RadioGroup value={tableMode} onValueChange={handleTableModeChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="font-normal cursor-pointer">
                  Use Existing Table
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" disabled={disableNewTable} />
                <Label
                  htmlFor="new"
                  className={`font-normal ${disableNewTable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Create New Table
                  {disableNewTable && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Only available with Insert strategy)
                    </span>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {tableMode === 'existing' && (
            <div className="space-y-2">
              <Label htmlFor="table">Destination Table *</Label>
              {tablesLoading ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading tables...</span>
                </div>
              ) : tables && tables.tables.length > 0 ? (
                <Select
                  value={
                    value?.schema && value?.tableName
                      ? `${value.schema}.${value.tableName}`
                      : ''
                  }
                  onValueChange={handleTableChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.tables.map((table) => (
                      <SelectItem
                        key={`${table.schema_name}.${table.name}`}
                        value={`${table.schema_name}.${table.name}`}
                      >
                        {table.schema_name}.{table.name} ({table.column_count} columns)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 border rounded-md bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    No tables found in this database.
                  </p>
                </div>
              )}
            </div>
          )}

          {tableMode === 'new' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new_schema">Schema *</Label>
                  <Input
                    id="new_schema"
                    value={value?.schema || 'public'}
                    onChange={(e) => handleNewTableSchemaChange(e.target.value)}
                    placeholder="public"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_table">Table Name *</Label>
                  <Input
                    id="new_table"
                    value={value?.tableName || ''}
                    onChange={(e) => handleNewTableNameChange(e.target.value)}
                    placeholder="my_table"
                  />
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Table will be created when the job first runs based on your column mappings.
                  The DDL will be generated and shown in the review step. Automatically includes{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">created_at</code> and{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">updated_at</code>{' '}
                  timestamp columns.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </>
      )}

      {schemaLoading && (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/10">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading table schema for column mapping...
          </span>
        </div>
      )}
    </div>
  )
}
