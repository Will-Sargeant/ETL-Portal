/**
 * Step 4: Column Mapping & Transformations
 * Map columns, apply transformations, add calculated columns
 * Uses a two-column grid interface for clearer mapping visualization
 */

import { useState, useEffect, useRef } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Info, Check, X, ChevronDown } from 'lucide-react'
import { ColumnMappingGrid } from './ColumnMappingGrid'
import type { WizardState } from './types'
import type { ColumnMappingConfig } from '@/types/source'

interface ColumnMappingStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
}

export function ColumnMappingStep({ state, onUpdate }: ColumnMappingStepProps) {
  const [showUpsertKeysDropdown, setShowUpsertKeysDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleMappingsChange = (mappings: ColumnMappingConfig[]) => {
    onUpdate({ columnMappings: mappings })
  }

  const isCreatingNewTable = state.destinationConfig?.createNewTable ?? false
  const tableColumns = state.tableSchema?.columns || null
  const loadStrategy = state.loadStrategy

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUpsertKeysDropdown(false)
      }
    }

    if (showUpsertKeysDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUpsertKeysDropdown])

  // Get available columns for upsert keys (only non-excluded columns with destination names)
  const getAvailableUpsertColumns = (): string[] => {
    return state.columnMappings
      .filter(m => !m.exclude && m.destinationColumn)
      .map(m => m.destinationColumn as string)
  }

  const handleToggleUpsertKey = (columnName: string) => {
    const currentKeys = state.destinationConfig?.upsertKeys || []
    const newKeys = currentKeys.includes(columnName)
      ? currentKeys.filter(k => k !== columnName)
      : [...currentKeys, columnName]

    onUpdate({
      destinationConfig: {
        ...state.destinationConfig!,
        upsertKeys: newKeys,
      },
    })
  }

  const handleRemoveUpsertKey = (columnName: string) => {
    const currentKeys = state.destinationConfig?.upsertKeys || []
    onUpdate({
      destinationConfig: {
        ...state.destinationConfig!,
        upsertKeys: currentKeys.filter(k => k !== columnName),
      },
    })
  }

  // Get capabilities based on load strategy
  const getStrategyCapabilities = () => {
    switch (loadStrategy) {
      case 'insert':
        return {
          allowed: [
            'Add calculated columns',
            'Exclude optional columns',
            'Apply transformations',
          ],
          disallowed: [
            'Edit column names',
          ],
        }
      case 'upsert':
        return {
          allowed: [
            'Apply transformations',
          ],
          disallowed: [
            'Add calculated columns',
            'Exclude columns',
            'Edit column names',
          ],
          warnings: [
            'All columns must be mapped exactly',
          ],
        }
      case 'truncate_insert':
        return {
          allowed: [
            'Edit column names',
            'Add calculated columns',
            'Exclude optional columns',
            'Apply transformations',
          ],
          disallowed: [],
        }
      default:
        return { allowed: [], disallowed: [] }
    }
  }

  const capabilities = getStrategyCapabilities()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Column Mapping & Transformations</h2>
        <p className="text-muted-foreground mt-1">
          Map CSV columns to database columns and configure calculated fields
        </p>
      </div>

      {/* Strategy Capabilities Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {loadStrategy.replace('_', ' & ').replace(/\b\w/g, (l) => l.toUpperCase())} Strategy Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {capabilities.allowed.length > 0 && (
            <div className="space-y-2">
              {capabilities.allowed.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
          {capabilities.disallowed.length > 0 && (
            <div className="space-y-2">
              {capabilities.disallowed.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-destructive" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
          {capabilities.warnings && capabilities.warnings.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              {capabilities.warnings.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Info className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-700">{item}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ColumnMappingGrid
        columnMappings={state.columnMappings}
        tableSchema={tableColumns}
        onChange={handleMappingsChange}
        isCreatingNewTable={isCreatingNewTable}
        loadStrategy={loadStrategy}
      />

      {/* Upsert Keys Selector - Only for Upsert Strategy */}
      {loadStrategy === 'upsert' && (
        <Card>
          <CardHeader>
            <CardTitle>Upsert Key Columns</CardTitle>
            <CardDescription>
              Select the column(s) used to identify existing rows for update operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="upsert_keys">Select Columns *</Label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowUpsertKeysDropdown(!showUpsertKeysDropdown)}
                  className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {state.destinationConfig?.upsertKeys && state.destinationConfig.upsertKeys.length > 0 ? (
                      state.destinationConfig.upsertKeys.map(key => (
                        <Badge key={key} variant="secondary" className="gap-1">
                          {key}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveUpsertKey(key)
                            }}
                          />
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Select upsert key columns...</span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50 ml-2 flex-shrink-0" />
                </button>

                {showUpsertKeysDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {getAvailableUpsertColumns().length > 0 ? (
                        getAvailableUpsertColumns().map(columnName => (
                          <label
                            key={columnName}
                            className="flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={state.destinationConfig?.upsertKeys?.includes(columnName) || false}
                              onCheckedChange={() => handleToggleUpsertKey(columnName)}
                            />
                            <span className="text-sm">{columnName}</span>
                          </label>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground p-2">
                          <p>No columns available. Ensure columns are mapped and not excluded.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                These columns uniquely identify rows. Matching rows will be updated, non-matching rows will be inserted.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
