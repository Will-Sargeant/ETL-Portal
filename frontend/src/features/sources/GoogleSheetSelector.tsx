import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, Search, Clock, FileSpreadsheet, ChevronDown, Info } from 'lucide-react'

interface Spreadsheet {
  id: string
  name: string
  modified?: string
}

interface Sheet {
  id: number
  name: string
  index: number
}

interface PreviewData {
  columns: string[]
  data: Record<string, any>[]
  total_rows: number
}

interface RangeConfig {
  start_row?: number
  header_row?: number
  end_row?: number
  start_column?: string
  end_column?: string
}

interface GoogleSheetSelectorProps {
  credentials: string
  onSelect: (spreadsheetId: string, sheetName: string, columns: string[], rangeConfig?: RangeConfig) => void
  initialConfig?: {
    spreadsheetId?: string
    sheetName?: string
    rangeConfig?: RangeConfig
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

// Convert range configuration to Google Sheets A1 notation
const getRangeA1Notation = (rangeConfig: RangeConfig): string => {
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

export function GoogleSheetSelector({ credentials, onSelect, initialConfig }: GoogleSheetSelectorProps) {
  const [allSpreadsheets, setAllSpreadsheets] = useState<Spreadsheet[]>([])
  const [recentSpreadsheets, setRecentSpreadsheets] = useState<Spreadsheet[]>([])
  const [filteredSpreadsheets, setFilteredSpreadsheets] = useState<Spreadsheet[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState('')
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)

  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false)
  const [isLoadingSheets, setIsLoadingSheets] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Range configuration
  const [rangeConfig, setRangeConfig] = useState<RangeConfig>({
    start_row: 1,
    header_row: undefined, // Will default to start_row on backend
  })
  const [showAdvancedRange, setShowAdvancedRange] = useState(false)
  const [rangeValidationError, setRangeValidationError] = useState<string | null>(null)

  // Restore previous selections when user navigates back to this step
  useEffect(() => {
    if (initialConfig?.spreadsheetId && initialConfig?.sheetName) {
      setSelectedSpreadsheet(initialConfig.spreadsheetId)
      setSelectedSheet(initialConfig.sheetName)

      // Auto-load sheets for the restored selection
      loadSheets(initialConfig.spreadsheetId)

      if (initialConfig.rangeConfig) {
        setRangeConfig(initialConfig.rangeConfig)
        // Show advanced range if any non-default values are set
        if (initialConfig.rangeConfig.end_row ||
            initialConfig.rangeConfig.start_column !== 'A' ||
            initialConfig.rangeConfig.end_column) {
          setShowAdvancedRange(true)
        }
      }

      loadPreview(initialConfig.spreadsheetId, initialConfig.sheetName, initialConfig.rangeConfig)
    }
    // Only run once on mount - do not re-run when initialConfig changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load recent spreadsheets on mount
  useEffect(() => {
    loadRecentSpreadsheets()
  }, [credentials])

  // Filter spreadsheets based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSpreadsheets([])
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allSpreadsheets.filter(s =>
      s.name.toLowerCase().includes(query)
    )
    setFilteredSpreadsheets(filtered)
  }, [searchQuery, allSpreadsheets])

  // Load sheets when spreadsheet selected
  useEffect(() => {
    if (selectedSpreadsheet) {
      loadSheets(selectedSpreadsheet)
    } else {
      setSheets([])
      setSelectedSheet('')
      setPreviewData(null)
    }
  }, [selectedSpreadsheet])

  // Load preview when sheet selected
  useEffect(() => {
    if (selectedSpreadsheet && selectedSheet) {
      loadPreview(selectedSpreadsheet, selectedSheet, rangeConfig)
    } else {
      setPreviewData(null)
    }
  }, [selectedSpreadsheet, selectedSheet])

  // Validate range whenever it changes
  useEffect(() => {
    const error = validateRange(rangeConfig)
    setRangeValidationError(error)
  }, [rangeConfig])

  // Validate range configuration
  const validateRange = (config: RangeConfig): string | null => {
    // Validate row range
    if (config.end_row !== undefined && config.start_row !== undefined) {
      if (config.start_row > config.end_row) {
        return `Invalid row range: Start row (${config.start_row}) cannot be greater than end row (${config.end_row})`
      }
    }

    // Validate column range
    if (config.end_column && config.start_column) {
      const startColIndex = columnLetterToIndex(config.start_column)
      const endColIndex = columnLetterToIndex(config.end_column)
      if (startColIndex > endColIndex) {
        return `Invalid column range: Start column (${config.start_column}) cannot be after end column (${config.end_column})`
      }
    }

    return null // No errors
  }

  // Function to refresh preview with current range config
  const refreshPreview = () => {
    // Validate before refreshing
    const error = validateRange(rangeConfig)
    setRangeValidationError(error)

    if (error) {
      toast.error('Invalid range configuration', {
        description: error,
      })
      return
    }

    if (selectedSpreadsheet && selectedSheet) {
      loadPreview(selectedSpreadsheet, selectedSheet, rangeConfig)
    }
  }

  const loadRecentSpreadsheets = async () => {
    setIsLoadingSpreadsheets(true)
    try {
      const { data } = await apiClient.post('/google/sheets/spreadsheets', {
        encrypted_credentials: credentials,
        limit: 10,
        order_by: 'modifiedTime desc'
      })
      setRecentSpreadsheets(data.spreadsheets)
    } catch (error) {
      toast.error('Failed to load spreadsheets', {
        description: 'Could not fetch your Google Spreadsheets',
      })
    } finally {
      setIsLoadingSpreadsheets(false)
    }
  }

  const loadAllSpreadsheets = async () => {
    setIsLoadingSpreadsheets(true)
    try {
      const { data } = await apiClient.post('/google/sheets/spreadsheets', {
        encrypted_credentials: credentials,
        limit: 1000,
        order_by: 'modifiedTime desc'
      })
      setAllSpreadsheets(data.spreadsheets)
      setShowAll(true)
    } catch (error) {
      toast.error('Failed to load all spreadsheets', {
        description: 'Could not fetch your Google Spreadsheets',
      })
    } finally {
      setIsLoadingSpreadsheets(false)
    }
  }

  const loadSheets = async (spreadsheetId: string) => {
    setIsLoadingSheets(true)
    try {
      const { data } = await apiClient.post(
        `/google/sheets/spreadsheets/${spreadsheetId}/sheets`,
        { encrypted_credentials: credentials }
      )
      setSheets(data.sheets)
    } catch (error) {
      toast.error('Failed to load sheets', {
        description: 'Could not fetch sheets from this spreadsheet',
      })
    } finally {
      setIsLoadingSheets(false)
    }
  }

  const loadPreview = async (spreadsheetId: string, sheetName: string, customRange?: RangeConfig) => {
    setIsLoadingPreview(true)
    try {
      const { data } = await apiClient.post('/google/sheets/preview', {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        encrypted_credentials: credentials,
        ...customRange
      })
      setPreviewData(data)
      onSelect(spreadsheetId, sheetName, data.columns, customRange)
    } catch (error) {
      console.error('Preview error:', error)
      toast.error('Failed to load preview', {
        description: 'Could not preview sheet data',
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  // Determine which spreadsheets to show
  const displaySpreadsheets = searchQuery.trim()
    ? filteredSpreadsheets
    : showAll
      ? allSpreadsheets
      : recentSpreadsheets

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search spreadsheets by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (allSpreadsheets.length === 0 && !showAll) {
              loadAllSpreadsheets()
            }
          }}
          className="pl-10"
        />
      </div>

      {/* Spreadsheet Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium flex items-center gap-2">
            {searchQuery.trim() ? (
              <>
                <Search className="h-4 w-4" />
                Search Results ({filteredSpreadsheets.length})
              </>
            ) : showAll ? (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                All Spreadsheets ({allSpreadsheets.length})
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Recently Modified
              </>
            )}
          </label>

          {!showAll && !searchQuery.trim() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAllSpreadsheets}
              disabled={isLoadingSpreadsheets}
            >
              Show All
            </Button>
          )}
        </div>

        {isLoadingSpreadsheets ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading spreadsheets...
          </div>
        ) : displaySpreadsheets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery.trim()
              ? 'No spreadsheets match your search'
              : 'No spreadsheets found'}
          </div>
        ) : (
          <Select value={selectedSpreadsheet} onValueChange={setSelectedSpreadsheet}>
            <SelectTrigger>
              <SelectValue placeholder="Select a spreadsheet..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-auto">
              {displaySpreadsheets.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatDate(s.modified)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sheet Selection */}
      {sheets.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">
            Select Sheet
          </label>
          {isLoadingSheets ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sheets...
            </div>
          ) : (
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sheet..." />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Range Configuration */}
      {selectedSheet && (
        <Collapsible open={showAdvancedRange} onOpenChange={setShowAdvancedRange}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Advanced Range Options
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedRange ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Use custom ranges when:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Your data doesn't start at row 1 or column A</li>
                  <li>You want to exclude certain rows or columns</li>
                  <li>You need to read only a specific portion of the sheet</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-row" className="flex items-center gap-2">
                  Start Row <span className="text-xs text-muted-foreground font-normal">(required)</span>
                </Label>
                <Input
                  id="start-row"
                  type="number"
                  min={1}
                  value={rangeConfig.start_row || 1}
                  onChange={(e) => {
                    const startRow = parseInt(e.target.value) || 1
                    setRangeConfig({
                      ...rangeConfig,
                      start_row: startRow,
                      // Auto-sync: If header_row is undefined or equals old start_row, update it
                      header_row: rangeConfig.header_row === rangeConfig.start_row || !rangeConfig.header_row
                        ? undefined  // Let backend default to start_row
                        : rangeConfig.header_row
                    })
                  }}
                  placeholder="1"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  First row to read. Headers default to this row unless specified below.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="header-row" className="flex items-center gap-2">
                  Header Row <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="header-row"
                  type="number"
                  min={1}
                  value={rangeConfig.header_row !== undefined ? rangeConfig.header_row : rangeConfig.start_row || 1}
                  onChange={(e) => {
                    const headerRow = e.target.value ? parseInt(e.target.value) : undefined
                    setRangeConfig({ ...rangeConfig, header_row: headerRow })
                  }}
                  placeholder={`Defaults to row ${rangeConfig.start_row || 1}`}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Row with column names. Leave empty to use Start Row.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-row" className="flex items-center gap-2">
                  End Row <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="end-row"
                  type="number"
                  min={rangeConfig.start_row || 1}
                  value={rangeConfig.end_row || ''}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, end_row: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Read all rows"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Last row to include. Leave empty to read until the end.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-column" className="flex items-center gap-2">
                  Start Column <span className="text-xs text-muted-foreground font-normal">(required)</span>
                </Label>
                <Input
                  id="start-column"
                  type="text"
                  value={rangeConfig.start_column || 'A'}
                  onChange={(e) => {
                    const col = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
                    setRangeConfig({ ...rangeConfig, start_column: col || 'A' })
                  }}
                  placeholder="A"
                  maxLength={3}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  First column to read (A, B, C, ..., Z, AA, AB, ...)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-column" className="flex items-center gap-2">
                  End Column <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="end-column"
                  type="text"
                  value={rangeConfig.end_column || ''}
                  onChange={(e) => {
                    const col = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
                    setRangeConfig({ ...rangeConfig, end_column: col || undefined })
                  }}
                  placeholder="Read all columns"
                  maxLength={3}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Last column to include. Leave empty to read all.
                </p>
              </div>
            </div>

            {/* Validation Error Alert */}
            {rangeValidationError && (
              <Alert variant="destructive">
                <AlertDescription>{rangeValidationError}</AlertDescription>
              </Alert>
            )}

            {/* Range Summary */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                📊 Range Preview
              </p>
              <p className="text-lg font-bold font-mono text-blue-900 dark:text-blue-100 mb-2">
                {getRangeA1Notation(rangeConfig)}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Starting at row {rangeConfig.start_row || 1}
                {rangeConfig.end_row && `, ending at row ${rangeConfig.end_row}`}
                {rangeConfig.start_column !== 'A' && `, from column ${rangeConfig.start_column}`}
                {rangeConfig.end_column && ` to column ${rangeConfig.end_column}`}
              </p>
              {rangeConfig.header_row && rangeConfig.header_row !== rangeConfig.start_row && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Headers from row {rangeConfig.header_row}
                </p>
              )}
            </div>

            <Button onClick={refreshPreview} disabled={isLoadingPreview || !!rangeValidationError} className="w-full">
              {isLoadingPreview ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating Preview...
                </>
              ) : (
                '🔄 Apply Range & Refresh Preview'
              )}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Loading Preview */}
      {isLoadingPreview && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preview...
        </div>
      )}

      {/* Preview Table */}
      {previewData && !isLoadingPreview && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b">
            <h3 className="text-sm font-medium">
              Preview ({previewData.total_rows} rows)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                {/* Column letter row (like Google Sheets) */}
                <tr className="border-b bg-gray-100 dark:bg-gray-800/50">
                  {/* Empty corner cell */}
                  <th className="px-4 py-2 text-center font-medium text-xs w-16 sticky left-0 bg-gray-100 dark:bg-gray-800/50 border-r border-b">
                    <span className="text-muted-foreground"></span>
                  </th>

                  {/* Column letters */}
                  {previewData.columns.map((col, idx) => (
                    <th key={`letter-${col}`} className="px-4 py-2 text-center font-medium text-xs bg-gray-100 dark:bg-gray-800/50">
                      <span className="text-muted-foreground font-mono">
                        {getColumnLetter(idx, rangeConfig.start_column)}
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
                  {previewData.columns.map((col) => (
                    <th key={col} className="px-4 py-3 text-left font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    {/* Row number cell */}
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground text-center sticky left-0 bg-gray-100 dark:bg-gray-800/50 border-r">
                      {(rangeConfig.start_row || 1) + idx}
                    </td>

                    {/* Data cells */}
                    {previewData.columns.map((col) => (
                      <td key={col} className="px-4 py-3">
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-muted-foreground italic text-xs">
                            null
                          </span>
                        ) : (
                          <span className="break-words">
                            {String(row[col])}
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
    </div>
  )
}
