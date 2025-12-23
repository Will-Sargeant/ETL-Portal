import { useQuery } from '@tanstack/react-query'
import { Table2, Columns } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { destinationsApi } from '@/lib/api/credentials'

interface TableBrowserProps {
  credentialId: number
  credentialName: string
}

export function TableBrowser({ credentialId, credentialName }: TableBrowserProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tables', credentialId],
    queryFn: () => destinationsApi.listTables(credentialId),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading tables...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive">Failed to load tables</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const tables = data?.tables || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables in {credentialName}</CardTitle>
        <CardDescription>
          {tables.length} table{tables.length !== 1 ? 's' : ''} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tables.length === 0 ? (
          <div className="text-center p-8">
            <Table2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No tables found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tables.map((table, idx) => (
              <div
                key={`${table.schema_name}.${table.name}-${idx}`}
                className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Table2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {table.schema_name}.{table.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Columns className="w-3 h-3" />
                        {table.column_count} columns
                      </span>
                      {table.row_count !== null && table.row_count !== undefined && (
                        <span>{table.row_count.toLocaleString()} rows</span>
                      )}
                    </div>
                  </div>
                </div>

                {table.columns && table.columns.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      View columns
                    </summary>
                    <div className="mt-2 pl-4 space-y-1">
                      {table.columns.map((col, colIdx) => (
                        <div
                          key={`${col.name}-${colIdx}`}
                          className="text-xs flex items-center gap-2"
                        >
                          <span className="font-mono">{col.name}</span>
                          <span className="text-muted-foreground">{col.type}</span>
                          {!col.nullable && (
                            <span className="text-xs px-1 bg-muted rounded">NOT NULL</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
