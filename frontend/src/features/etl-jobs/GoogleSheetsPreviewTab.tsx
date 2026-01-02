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

// Convert range configuration to Google Sheets A1 notation
const getRangeA1Notation = (rangeConfig: {
  start_row?: number
  header_row?: number
  end_row?: number
  start_column?: string
  end_column?: string
}): string => {
  const startCol = rangeConfig.start_column || 'A'
  const startRow = rangeConfig.start_row || 1
  const endCol = rangeConfig.end_column || ''
  const endRow = rangeConfig.end_row || ''

  // Build the A1 notation
  if (endCol && endRow) {
    return `${startCol}${startRow}:${endCol}${endRow}`
  } else if (endCol) {
    return `${startCol}${startRow}:${endCol}`
  } else if (endRow) {
    return `${startCol}${startRow}:${endRow}`
  } else {
    return `${startCol}${startRow}:*`
  }
}

// Convert column letter to index (A -> 0, B -> 1, Z -> 25, AA -> 26)
const columnLetterToIndex = (letter: string): number => {
  let index = 0
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64)
  }
  return index - 1
}

// Convert column index to Excel-style letter (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
const getColumnLetter = (index: number, startColumn: string = 'A'): string => {
  // Calculate the actual column index based on start column
  const startIndex = columnLetterToIndex(startColumn)
  const actualIndex = startIndex + index

  let letter = ''
  let num = actualIndex
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }
  return letter
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

  // Extract range configuration from job
  const rangeConfig = {
    start_row: job.source_config?.start_row,
    header_row: job.source_config?.header_row,
    end_row: job.source_config?.end_row,
    start_column: job.source_config?.start_column,
    end_column: job.source_config?.end_column,
  }

  const { data: preview, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['google-sheets-preview', spreadsheetId, sheetName, rangeConfig],
    queryFn: async () => {
      const response = await apiClient.post('/google/sheets/preview', {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        encrypted_credentials: credentials,
        ...rangeConfig,
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

        {/* Range Configuration Display */}
        {(rangeConfig.start_row !== undefined && rangeConfig.start_row !== 1) ||
         rangeConfig.header_row ||
         rangeConfig.end_row ||
         (rangeConfig.start_column && rangeConfig.start_column !== 'A') ||
         rangeConfig.end_column ? (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <h4 className="text-sm font-semibold mb-3 text-blue-900 dark:text-blue-100">
              📊 Custom Range Configuration
            </h4>
            {/* A1 Notation Display */}
            <div className="mb-3 p-3 bg-blue-100 dark:bg-blue-900/50 rounded border border-blue-300 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Google Sheets Range</p>
              <p className="text-lg font-bold font-mono text-blue-900 dark:text-blue-100">
                {getRangeA1Notation(rangeConfig)}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              {rangeConfig.start_row !== undefined && rangeConfig.start_row !== 1 && (
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Start Row</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">{rangeConfig.start_row}</p>
                </div>
              )}
              {rangeConfig.header_row && (
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Header Row</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">{rangeConfig.header_row}</p>
                </div>
              )}
              {rangeConfig.end_row && (
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">End Row</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">{rangeConfig.end_row}</p>
                </div>
              )}
              {rangeConfig.start_column && rangeConfig.start_column !== 'A' && (
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Start Column</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">{rangeConfig.start_column}</p>
                </div>
              )}
              {rangeConfig.end_column && (
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">End Column</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">{rangeConfig.end_column}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
              ℹ️ This job reads a custom range from the spreadsheet. The preview above reflects this configuration.
            </p>
          </div>
        ) : null}

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
                <thead>
                  {/* Column letter row (like Google Sheets) */}
                  <tr className="border-b bg-gray-100 dark:bg-gray-800/50">
                    {/* Empty corner cell */}
                    <th className="px-4 py-2 text-center font-medium text-xs w-16 sticky left-0 bg-gray-100 dark:bg-gray-800/50 border-r border-b">
                      <span className="text-muted-foreground"></span>
                    </th>

                    {/* Column letters */}
                    {columns.map((col, idx) => (
                      <th key={`letter-${col}`} className="px-4 py-2 text-center font-medium text-xs bg-gray-100 dark:bg-gray-800/50">
                        <span className="text-muted-foreground font-mono">
                          {getColumnLetter(idx, rangeConfig.start_column || 'A')}
                        </span>
                      </th>
                    ))}
                  </tr>

                  {/* Header row with column names */}
                  <tr className="bg-muted/50">
                    {/* Header row number */}
                    <th className="px-4 py-3 text-center font-medium text-xs w-16 sticky left-0 bg-gray-100 dark:bg-gray-800/50 border-r">
                      <span className="text-muted-foreground font-mono">{rangeConfig.header_row || rangeConfig.start_row || 1}</span>
                    </th>

                    {/* Column names */}
                    {columns.map((colName) => (
                      <th key={colName} className="px-4 py-3 text-left font-medium">
                        <div className="truncate">{colName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      {/* Row number cell */}
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground text-center sticky left-0 bg-gray-100 dark:bg-gray-800/50 border-r">
                        {(() => {
                          const startRow = rangeConfig.start_row || 1
                          const headerRow = rangeConfig.header_row

                          // If header_row is specified and it's before start_row, data starts at start_row
                          // Otherwise, data starts the row after the header
                          if (headerRow !== undefined && headerRow < startRow) {
                            return startRow + idx
                          } else {
                            return (headerRow || startRow) + idx + 1
                          }
                        })()}
                      </td>

                      {/* Data cells */}
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
