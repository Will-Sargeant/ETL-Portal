import { FileText, Database, Table2, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ETLJobCreate } from '@/types/etl-job'

interface ReviewStepProps {
  data: ETLJobCreate
}

export function ReviewStep({ data }: ReviewStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Job Name</p>
              <p className="font-medium">{data.name}</p>
            </div>
            {data.description && (
              <div>
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{data.description}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Batch Size</p>
              <p className="font-medium">{data.batch_size.toLocaleString()} rows</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Source Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Source Type</p>
              <p className="font-medium uppercase">{data.source_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">File Path</p>
              <p className="font-medium font-mono text-xs">{data.source_config.file_path}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            Destination Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Database Type</p>
              <p className="font-medium uppercase">{data.destination_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Table</p>
              <p className="font-medium">
                {data.destination_config.schema_name}.{data.destination_config.table_name}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Load Strategy</p>
              <p className="font-medium capitalize">{data.load_strategy.replace('_', ' ')}</p>
            </div>
            {data.upsert_keys && data.upsert_keys.length > 0 && (
              <div>
                <p className="text-muted-foreground">Upsert Keys</p>
                <p className="font-medium">{data.upsert_keys.join(', ')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="w-4 h-4" />
            Column Mappings ({data.column_mappings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.column_mappings.map((mapping, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm"
              >
                <div className="flex-1">
                  <p className="font-medium font-mono text-xs">{mapping.source_column}</p>
                  <p className="text-xs text-muted-foreground">{mapping.source_type}</p>
                </div>
                <div className="text-muted-foreground">→</div>
                <div className="flex-1">
                  <p className="font-medium font-mono text-xs">{mapping.destination_column}</p>
                  <p className="text-xs text-muted-foreground">{mapping.destination_type}</p>
                </div>
                {mapping.transformation && (
                  <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                    {mapping.transformation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Review the configuration above. Click <strong>Create Job</strong> when ready to create
          this ETL job.
        </p>
      </div>
    </div>
  )
}
