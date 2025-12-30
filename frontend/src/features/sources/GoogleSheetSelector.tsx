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
}

export function GoogleSheetSelector({ credentials, onSelect }: GoogleSheetSelectorProps) {
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
    header_row: 1,
  })
  const [showAdvancedRange, setShowAdvancedRange] = useState(false)

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

  // Function to refresh preview with current range config
  const refreshPreview = () => {
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
            <SelectContent>
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
                Configure custom ranges for sheets with headers not in row 1, or to exclude certain rows/columns.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-row">Start Row</Label>
                <Input
                  id="start-row"
                  type="number"
                  min={1}
                  value={rangeConfig.start_row || 1}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, start_row: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground mt-1">First row to read (1-indexed)</p>
              </div>

              <div>
                <Label htmlFor="header-row">Header Row</Label>
                <Input
                  id="header-row"
                  type="number"
                  min={1}
                  value={rangeConfig.header_row || 1}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, header_row: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground mt-1">Row containing column headers</p>
              </div>

              <div>
                <Label htmlFor="end-row">End Row (Optional)</Label>
                <Input
                  id="end-row"
                  type="number"
                  min={1}
                  value={rangeConfig.end_row || ''}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, end_row: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="All rows"
                />
                <p className="text-xs text-muted-foreground mt-1">Last row to read (leave empty for all)</p>
              </div>

              <div>
                <Label htmlFor="start-column">Start Column</Label>
                <Input
                  id="start-column"
                  type="text"
                  value={rangeConfig.start_column || 'A'}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, start_column: e.target.value.toUpperCase() || 'A' })}
                  placeholder="A"
                  maxLength={3}
                />
                <p className="text-xs text-muted-foreground mt-1">First column (A, B, C, etc.)</p>
              </div>

              <div>
                <Label htmlFor="end-column">End Column (Optional)</Label>
                <Input
                  id="end-column"
                  type="text"
                  value={rangeConfig.end_column || ''}
                  onChange={(e) => setRangeConfig({ ...rangeConfig, end_column: e.target.value.toUpperCase() || undefined })}
                  placeholder="All columns"
                  maxLength={3}
                />
                <p className="text-xs text-muted-foreground mt-1">Last column (leave empty for all)</p>
              </div>
            </div>

            <Button onClick={refreshPreview} disabled={isLoadingPreview} className="w-full">
              {isLoadingPreview ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating Preview...
                </>
              ) : (
                'Apply Range & Refresh Preview'
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
              <thead className="bg-muted/50">
                <tr>
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
