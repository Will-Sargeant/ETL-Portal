import type { UploadResponse, ColumnMappingConfig } from '@/types/source'
import type { DestinationConfig, TableSchema } from '@/types/destination'
import { DestinationSelector } from './DestinationSelector'
import { ColumnMappingEditor } from './ColumnMappingEditor'

interface DestinationMappingStepProps {
  uploadedData: UploadResponse
  destination: DestinationConfig | null
  tableSchema: TableSchema | null
  columnMappings: ColumnMappingConfig[]
  onDestinationChange: (config: DestinationConfig) => void
  onTableSchemaFetched: (schema: TableSchema) => void
  onColumnMappingsChange: (mappings: ColumnMappingConfig[]) => void
}

export function DestinationMappingStep({
  uploadedData,
  destination,
  tableSchema,
  columnMappings,
  onDestinationChange,
  onTableSchemaFetched,
  onColumnMappingsChange,
}: DestinationMappingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Destination Configuration</h3>
        <DestinationSelector
          value={destination}
          onChange={onDestinationChange}
          onTableSchemaFetched={onTableSchemaFetched}
          columnMappings={columnMappings}
        />
      </div>

      {columnMappings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Column Mappings</h3>
          <ColumnMappingEditor
            sourceColumns={uploadedData.columns}
            tableSchema={tableSchema}
            value={columnMappings}
            onChange={onColumnMappingsChange}
          />
        </div>
      )}
    </div>
  )
}
