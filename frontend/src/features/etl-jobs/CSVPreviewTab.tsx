import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { sourcesApi } from '@/lib/api/sources'
import type { ETLJob } from '@/types/etl-job'

interface CSVPreviewTabProps {
  job: ETLJob
}

const getDataTypeColor = (dataType: string) => {
  switch (dataType) {
    case 'number':
      return 'text-blue-600 dark:text-blue-400'
    case 'date':
      return 'text-purple-600 dark:text-purple-400'
    case 'boolean':
      return 'text-green-600 dark:text-green-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

const getDataTypeBadge = (dataType: string) => {
  const colors = {
    number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    boolean: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    text: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  }

  return colors[dataType as keyof typeof colors] || colors.text
}

export function CSVPreviewTab({ job }: CSVPreviewTabProps) {
  const fileId = job.source_config?.file_id

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['csv-preview', fileId],
    queryFn: () => sourcesApi.getPreview(fileId!, 100),
    enabled: !!fileId,
  })

  const { data: metadata } = useQuery({
    queryKey: ['csv-metadata', fileId],
    queryFn: () => sourcesApi.getMetadata(fileId!),
    enabled: !!fileId,
  })

  if (!fileId) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No CSV file configured</p>
          <p className="text-sm text-muted-foreground">
            This job doesn't have a CSV source file. You can upload one in the Settings tab.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading CSV preview...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-medium mb-2">Failed to load CSV preview</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'The CSV file may have been deleted or moved'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!preview) {
    return null
  }

  // Handle both array of strings and array of objects for columns
  const columnInfo = preview.columns?.map(col => {
    // If col is an object (newer API format)
    if (typeof col === 'object' && col !== null) {
      return {
        name: col.name || '',
        data_type: col.data_type || 'text',
        unique_count: col.unique_count || null,
        null_count: col.null_count || 0
      }
    }
    // If col is a string (older API format)
    return {
      name: col,
      data_type: 'text',
      unique_count: null,
      null_count: 0
    }
  }) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Data Preview
        </CardTitle>
        <CardDescription>
          {metadata && (
            <>
              <span className="font-medium">{metadata.filename}</span>
              {' '}Showing {preview.rows?.length || 0} of {metadata.row_count.toLocaleString()} rows
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* File Metadata */}
        {metadata && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground mb-1">File ID</p>
              <p className="font-mono text-sm">{fileId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filename</p>
              <p className="font-medium text-sm truncate">{metadata.filename}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Rows</p>
              <p className="font-medium text-sm">{metadata.row_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Columns</p>
              <p className="font-medium text-sm">{metadata.column_count}</p>
            </div>
          </div>
        )}

        {/* Column Information */}
        {columnInfo.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3">Column Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {columnInfo.map((col) => (
                <div
                  key={col.name}
                  className="p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm truncate flex-1">
                      {col.name}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getDataTypeBadge(
                        col.data_type
                      )}`}
                    >
                      {col.data_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Table */}
        {preview.rows && Array.isArray(preview.rows) && preview.rows.length > 0 && columnInfo.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground w-12">
                      #
                    </th>
                    {columnInfo.map((col) => (
                      <th
                        key={col.name}
                        className="px-4 py-3 text-left font-medium"
                      >
                        <div className="space-y-1">
                          <div className="truncate">{col.name}</div>
                          <div
                            className={`text-xs ${getDataTypeColor(
                              col.data_type
                            )}`}
                          >
                            {col.data_type}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {idx + 1}
                      </td>
                      {columnInfo.map((col) => (
                        <td key={col.name} className="px-4 py-3">
                          {row[col.name] === null || row[col.name] === undefined ? (
                            <span className="text-muted-foreground italic text-xs">
                              null
                            </span>
                          ) : (
                            <span className="break-words">
                              {String(row[col.name])}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {preview.rows && (!Array.isArray(preview.rows) || preview.rows.length === 0) && (
          <div className="p-8 text-center text-muted-foreground">
            <p>No preview data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
