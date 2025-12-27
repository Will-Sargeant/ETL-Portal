/**
 * Step 3: Destination Configuration
 * Select load strategy, database credential, schema, and table
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { DestinationSelector } from '@/features/sources/DestinationSelector'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import type { DestinationConfig, TableSchema } from '@/types/destination'
import type { WizardState } from './types'
import { remapColumnsToTable } from './utils'

interface DestinationStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
}

export function DestinationStep({ state, onUpdate }: DestinationStepProps) {
  // Query to fetch existing jobs for the selected table (for calculated column expressions)
  const { data: existingJobs } = useQuery({
    queryKey: ['existing-jobs-for-table', state.destinationConfig?.schema, state.destinationConfig?.tableName],
    queryFn: async () => {
      return await etlJobsApi.getByDestination(
        state.destinationConfig!.schema,
        state.destinationConfig!.tableName
      )
    },
    enabled: !!(state.destinationConfig?.schema && state.destinationConfig?.tableName && !state.destinationConfig?.createNewTable),
  })

  const handleDestinationChange = (config: DestinationConfig) => {
    // Detect if credential or schema changed - reset mappings and schema if so
    const credentialChanged = state.destinationConfig?.credentialId !== config.credentialId
    const schemaChanged = state.destinationConfig?.schema !== config.schema

    if (credentialChanged || schemaChanged) {
      // Reset to only CSV columns (remove all table-only columns from previous selection)
      const csvColumnsOnly = state.columnMappings.filter(col => col.sourceColumn)
      onUpdate({
        destinationConfig: {
          ...config,
          loadStrategy: state.loadStrategy,
        },
        columnMappings: csvColumnsOnly,
        tableSchema: undefined, // Clear previous table schema
      })
    } else {
      onUpdate({
        destinationConfig: {
          ...config,
          loadStrategy: state.loadStrategy,
        },
      })
    }
  }

  const handleTableSchemaFetched = (schema: TableSchema) => {
    // When a table schema is fetched, intelligently remap CSV columns to table columns
    // Only remap if we have CSV columns and haven't already remapped for this table
    const shouldRemap = !state.destinationConfig?.createNewTable &&
                        state.columnMappings.length > 0 &&
                        state.tableSchema?.table_name !== schema.table_name

    if (shouldRemap) {
      // IMPORTANT: Only pass CSV columns (with sourceColumn), not table-only columns from previous table
      const csvColumnsOnly = state.columnMappings.filter(col => col.sourceColumn)

      const remappedColumns = remapColumnsToTable(csvColumnsOnly, schema.columns, state.loadStrategy)
      onUpdate({
        tableSchema: schema,
        columnMappings: remappedColumns,
      })
    } else {
      onUpdate({ tableSchema: schema })
    }
  }

  // Ensure destination config has the load strategy
  const destinationConfigWithStrategy: DestinationConfig | null = state.destinationConfig
    ? { ...state.destinationConfig, loadStrategy: state.loadStrategy }
    : null

  // Disable "Create New Table" for upsert and truncate_insert strategies
  const disableNewTable = state.loadStrategy === 'upsert' || state.loadStrategy === 'truncate_insert'

  // Auto-switch to existing table when load strategy requires it
  useEffect(() => {
    if (disableNewTable && state.destinationConfig?.createNewTable) {
      onUpdate({
        destinationConfig: {
          ...state.destinationConfig,
          createNewTable: false,
          tableName: '', // Clear table name since it was for a new table
        },
      })
    }
  }, [disableNewTable, state.destinationConfig, onUpdate])

  // Strategy requirements message
  const getStrategyMessage = () => {
    switch (state.loadStrategy) {
      case 'upsert':
        return {
          title: 'Upsert Strategy Requirements',
          description: 'Must use an existing table. Schema must match exactly. You\'ll configure upsert keys after selecting the table.',
        }
      case 'truncate_insert':
        return {
          title: 'Truncate & Insert Strategy',
          description: 'Table will be dropped and recreated on each run. You can modify column names and schema freely. All data is replaced each run.',
        }
      default:
        return null
    }
  }

  const strategyMessage = getStrategyMessage()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Destination Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Configure where your data will be loaded
        </p>
      </div>

      {strategyMessage && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{strategyMessage.title}:</strong> {strategyMessage.description}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Database & Table</CardTitle>
          <CardDescription>
            Choose your destination credential, schema, and table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DestinationSelector
            value={destinationConfigWithStrategy}
            onChange={handleDestinationChange}
            onTableSchemaFetched={handleTableSchemaFetched}
            columnMappings={state.columnMappings}
            disableNewTable={disableNewTable}
          />
        </CardContent>
      </Card>
    </div>
  )
}
