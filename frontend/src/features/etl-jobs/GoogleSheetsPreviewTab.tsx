import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { ETLJob } from '@/types/etl-job'

interface GoogleSheetsPreviewTabProps {
  job: ETLJob
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

export function GoogleSheetsPreviewTab({ job }: GoogleSheetsPreviewTabProps) {
  const spreadsheetId = job.source_config?.spreadsheet_id
  const sheetName = job.source_config?.sheet_name
  const credentials = job.source_config?.encrypted_credentials

  const { data: preview, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['google-sheets-preview', spreadsheetId, sheetName],
    queryFn: async () => {
      const response = await apiClient.post('/google/sheets/preview', {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        encrypted_credentials: credentials,
      })
      return response.data
    },
    enabled: !!(spreadsheetId && sheetName && credentials),
    staleTime: 0, // Always fetch fresh data
  })

  if (!spreadsheetId || !sheetName) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No Google Sheet configured</p>
          <p className="text-sm text-muted-foreground">
            This job doesn't have a Google Sheets source configured.
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
          <p className="text-muted-foreground">Loading Google Sheets data...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-medium mb-2">Failed to load Google Sheets data</p>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Unable to fetch data from Google Sheets'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!preview) {
    return null
  }

  const columns = preview.columns || []
  const rows = preview.data || []
  const totalRows = preview.total_rows || rows.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Google Sheets Preview
            </CardTitle>
            <CardDescription>
              <span className="font-medium">{sheetName}</span>
              {' '}Showing {rows.length} of {totalRows.toLocaleString()} rows (live data)
            </CardDescription>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isRefetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Sheet Metadata */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Spreadsheet ID</p>
            <p className="font-mono text-xs truncate">{spreadsheetId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sheet Name</p>
            <p className="font-medium text-sm">{sheetName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Rows</p>
            <p className="font-medium text-sm">{totalRows.toLocaleString()}</p>
          </div>
        </div>

        {/* Column Information */}
        {columns.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3">Columns ({columns.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {columns.map((colName) => (
                <div
                  key={colName}
                  className="p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm truncate flex-1">
                      {colName}
                    </p>
                    <Badge className={getDataTypeBadge('text')} variant="secondary">
                      TEXT
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Table */}
        {rows.length > 0 && columns.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground w-12">
                      #
                    </th>
                    {columns.map((colName) => (
                      <th
                        key={colName}
                        className="px-4 py-3 text-left font-medium"
                      >
                        <div className="truncate">{colName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {idx + 1}
                      </td>
                      {columns.map((colName) => (
                        <td key={colName} className="px-4 py-3">
                          {row[colName] === null || row[colName] === undefined || row[colName] === '' ? (
                            <span className="text-muted-foreground italic text-xs">
                              null
                            </span>
                          ) : (
                            <span className="break-words">
                              {String(row[colName])}
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

        {rows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <p>No data available in this sheet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
