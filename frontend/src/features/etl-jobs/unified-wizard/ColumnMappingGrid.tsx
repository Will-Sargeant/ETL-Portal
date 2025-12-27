/**
 * Column Mapping Grid - Unified two-column interface for mapping CSV columns to DB columns
 * Left: CSV/Source columns | Right: Database/Destination columns
 * All database columns shown in a single view with clear status indicators
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, ArrowRight, X, CheckCircle, Wand2 } from 'lucide-react'
import { getTransformationsByCategory } from '@/lib/transformations'
import type { ColumnMappingConfig } from '@/types/source'
import type { TableColumn } from '@/types/destination'

interface ColumnMappingGridProps {
  columnMappings: ColumnMappingConfig[]
  tableSchema: TableColumn[] | null
  onChange: (mappings: ColumnMappingConfig[]) => void
  isCreatingNewTable: boolean
  loadStrategy?: 'insert' | 'upsert' | 'truncate_insert'
}

export function ColumnMappingGrid({
  columnMappings,
  tableSchema,
  onChange,
  isCreatingNewTable,
  loadStrategy = 'insert',
}: ColumnMappingGridProps) {
  // For truncate_insert, allow editing column names (table will be recreated)
  const canEditColumnNames = isCreatingNewTable || loadStrategy === 'truncate_insert'

  // Get transformations grouped by category
  const transformationsByCategory = useMemo(() => getTransformationsByCategory(), [])

  // Separate columns into CSV-sourced and table-only
  const csvColumns = columnMappings.filter(col => col.sourceColumn)

  // Filter table-only columns to remove any that are already mapped from CSV columns
  // This handles the case where user manually maps a CSV column after the initial remapping
  const csvMappedColumnNames = new Set(
    csvColumns
      .filter(col => col.destinationColumn && !col.exclude)
      .map(col => col.destinationColumn!.toLowerCase())
  )

  // Only show table-only columns that are either:
  // 1. Calculated (have expressions)
  // 2. Have defaults
  // 3. Are nullable
  // Don't show NOT NULL columns with no defaults - those should be mapped from CSV columns
  const tableOnlyColumns = columnMappings
    .filter(col => !col.sourceColumn)
    .filter(col => !csvMappedColumnNames.has(col.destinationColumn?.toLowerCase() || ''))
    .filter(col => {
      // Show if it has an expression (calculated column)
      if (col.expression || col.isCalculated) return true
      // Show if it has a default value
      if (col.defaultValue) return true
      // Show if it's nullable
      if (col.isNullable) return true
      // Show if it's an auto-populated column (created_at, updated_at, etc.)
      const isAutoPopulated = col.destinationColumn?.toLowerCase().includes('created_at') ||
                             col.destinationColumn?.toLowerCase().includes('updated_at') ||
                             col.destinationColumn?.toLowerCase().includes('inserted_date')
      if (isAutoPopulated) return true
      // Otherwise, don't show - it should be mapped from a CSV column
      return false
    })

  // Combine all mappings for unified display: CSV columns first, then table-only columns
  const allMappings = [...csvColumns, ...tableOnlyColumns]

  // Get list of available table columns for mapping dropdown
  const getAvailableTableColumns = () => {
    if (!tableSchema) return []

    // For existing tables, show all table columns
    // For new tables, show destination columns from CSV mappings
    if (isCreatingNewTable) {
      return columnMappings
        .filter(m => !m.exclude && m.destinationColumn)
        .map(m => ({
          name: m.destinationColumn!,
          type: m.destinationType || 'TEXT',
          nullable: m.isNullable,
        }))
    }

    return tableSchema
  }

  // Handle mapping a CSV column to a DB column
  const handleMapColumn = (csvIndex: number, dbColumnName: string) => {
    let updated = [...columnMappings]
    const csvMapping = csvColumns[csvIndex]
    const dbColumn = tableSchema?.find(col => col.name === dbColumnName)

    if (!dbColumn) return

    // Find the index in the full array
    const fullIndex = columnMappings.findIndex(m =>
      m.sourceColumn === csvMapping.sourceColumn &&
      m.columnOrder === csvMapping.columnOrder
    )

    // Update the CSV column mapping
    updated[fullIndex] = {
      ...csvMapping,
      destinationColumn: dbColumn.name,
      destinationType: dbColumn.type.toUpperCase(),
      isNullable: dbColumn.nullable,
      exclude: false,
    }

    // Remove any table-only column with the same destination name to prevent duplicates
    updated = updated.filter((col, idx) => {
      // Keep all CSV columns (those with sourceColumn)
      if (col.sourceColumn) return true

      // For table-only columns, remove if destination matches the newly mapped column
      return col.destinationColumn?.toLowerCase() !== dbColumn.name.toLowerCase()
    })

    onChange(updated)
  }

  // Handle unmapping (exclude) a CSV column
  const handleUnmapColumn = (csvIndex: number) => {
    let updated = [...columnMappings]
    const csvMapping = csvColumns[csvIndex]
    const previousDestination = csvMapping.destinationColumn

    const fullIndex = columnMappings.findIndex(m =>
      m.sourceColumn === csvMapping.sourceColumn &&
      m.columnOrder === csvMapping.columnOrder
    )

    updated[fullIndex] = {
      ...csvMapping,
      destinationColumn: '', // Clear the destination column
      exclude: true,
    }

    // If there was a destination column and it exists in the table schema,
    // add it back as a table-only column
    if (previousDestination && tableSchema && !isCreatingNewTable) {
      const tableColumn = tableSchema.find(col => col.name === previousDestination)
      if (tableColumn) {
        // Check if this table column should be shown (nullable, has default, or calculated)
        const shouldAddBack = tableColumn.nullable ||
                             tableColumn.default ||
                             tableColumn.name.toLowerCase().includes('created_at') ||
                             tableColumn.name.toLowerCase().includes('updated_at') ||
                             tableColumn.name.toLowerCase().includes('inserted_date')

        if (shouldAddBack) {
          // Add back as table-only column
          updated.push({
            sourceColumn: '',
            destinationColumn: tableColumn.name,
            sourceType: '',
            destinationType: tableColumn.type.toUpperCase(),
            isNullable: tableColumn.nullable,
            defaultValue: tableColumn.default,
            exclude: false,
            columnOrder: updated.length,
          })
        }
      }
    }

    onChange(updated)
  }

  // Handle toggling transformations for a CSV column
  const handleToggleTransformation = (csvIndex: number, transformationName: string) => {
    const updated = [...columnMappings]
    const csvMapping = csvColumns[csvIndex]

    const fullIndex = columnMappings.findIndex(m =>
      m.sourceColumn === csvMapping.sourceColumn &&
      m.columnOrder === csvMapping.columnOrder
    )

    const currentTransformations = updated[fullIndex].transformations || []
    const newTransformations = currentTransformations.includes(transformationName)
      ? currentTransformations.filter(t => t !== transformationName)
      : [...currentTransformations, transformationName]

    updated[fullIndex] = {
      ...updated[fullIndex],
      transformations: newTransformations,
    }

    onChange(updated)
  }


  // Check if a DB column is mapped
  const isMapped = (dbColumnName: string) => {
    return csvColumns.some(col =>
      col.destinationColumn === dbColumnName && !col.exclude
    )
  }

  // Get unmapped required table columns (those that need attention)
  const getUnmappedRequiredColumns = () => {
    if (!tableSchema || isCreatingNewTable) return []

    // Check all table columns from schema - are they covered?
    return tableSchema
      .filter(tableCol => {
        // Column is required if NOT NULL and no default
        const isRequired = !tableCol.nullable && !tableCol.default
        if (!isRequired) return false // Skip nullable or columns with defaults

        // Check if this column is mapped from a CSV column
        const isMappedFromCSV = csvColumns.some(csvCol =>
          csvCol.destinationColumn === tableCol.name && !csvCol.exclude
        )
        if (isMappedFromCSV) return false // It's mapped, no action needed

        // This column needs attention!
        return true
      })
      .map(col => col.name)
  }

  const unmappedRequiredColumnNames = getUnmappedRequiredColumns()

  const getDataTypeBadge = (dataType: string) => {
    const colors: Record<string, string> = {
      text: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
      varchar: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
      integer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      bigint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      numeric: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      decimal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      boolean: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      timestamp: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    }
    return colors[dataType.toLowerCase()] || colors.text
  }

  return (
    <div className="space-y-6">
      {/* Warnings for unmapped required columns */}
      {unmappedRequiredColumnNames.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> {unmappedRequiredColumnNames.length} database column{unmappedRequiredColumnNames.length > 1 ? 's' : ''} ({unmappedRequiredColumnNames.join(', ')}) require{unmappedRequiredColumnNames.length === 1 ? 's' : ''} a value but {unmappedRequiredColumnNames.length === 1 ? 'has' : 'have'} no mapping or default.
            Please map {unmappedRequiredColumnNames.length === 1 ? 'it' : 'them'} to CSV columns.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
          <CardDescription>
            Map CSV columns to database table columns. Database columns without a CSV source are shown with their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header Row */}
            <div className="grid grid-cols-[1fr,auto,2fr] gap-4 pb-2 border-b font-semibold text-sm">
              <div>CSV Column</div>
              <div className="w-8"></div>
              <div>Database Column</div>
            </div>

            {/* All Column Mappings - CSV columns first, then table-only columns */}
            {allMappings.map((mapping, idx) => {
              const isTableOnly = !mapping.sourceColumn

              // A column "requires action" if:
              // 1. It's table-only, NOT NULL, no default
              // 2. It's a CSV column that is excluded (unmapped)
              const requiresAction = (isTableOnly &&
                                    !mapping.isNullable &&
                                    !mapping.defaultValue &&
                                    !(mapping.destinationColumn?.toLowerCase().includes('created_at')) &&
                                    !(mapping.destinationColumn?.toLowerCase().includes('updated_at')) &&
                                    !(mapping.destinationColumn?.toLowerCase().includes('inserted_date'))) ||
                                    (!isTableOnly && mapping.exclude)

              const hasDefault = isTableOnly && mapping.defaultValue
              const isNullableOnly = isTableOnly && mapping.isNullable && !hasDefault

              return (
                <div
                  key={idx}
                  className={`grid grid-cols-[auto,1fr,auto,2fr] gap-4 items-start p-3 rounded-lg border-2 ${
                    mapping.exclude ? 'bg-muted/30 opacity-60 border-muted' : 'border-border'
                  } ${requiresAction ? '!border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
                >
                  {/* Include/Exclude Checkbox */}
                  <div className="flex items-center pt-1">
                    <Checkbox
                      checked={!mapping.exclude}
                      onCheckedChange={(checked) => {
                        const updatedMappings = [...columnMappings]
                        updatedMappings[idx] = {
                          ...updatedMappings[idx],
                          exclude: !checked,
                        }
                        onChange(updatedMappings)
                      }}
                      aria-label={`Include ${mapping.destinationColumn || mapping.sourceColumn} in mapping`}
                    />
                  </div>

                  {/* Left: CSV Column (or empty for table-only columns) */}
                  <div className="flex items-center gap-2">
                    {!isTableOnly ? (
                      <>
                        <span className="font-mono text-sm font-medium">
                          {mapping.sourceColumn}
                        </span>
                        <Badge className={getDataTypeBadge(mapping.sourceType)}>
                          {mapping.sourceType}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        No CSV source
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />

                  {/* Right: DB Column Mapping & Status */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* For CSV columns - show mapping or dropdown */}
                      {!isTableOnly && (
                        <>
                          {!mapping.exclude && mapping.destinationColumn ? (
                            <>
                              {canEditColumnNames ? (
                                <Input
                                  value={mapping.destinationColumn}
                                  onChange={(e) => {
                                    const updatedMappings = [...columnMappings]
                                    updatedMappings[idx] = {
                                      ...updatedMappings[idx],
                                      destinationColumn: e.target.value,
                                    }
                                    onChange(updatedMappings)
                                  }}
                                  className="font-mono text-sm max-w-[200px]"
                                  placeholder="column_name"
                                />
                              ) : (
                                <span className="font-mono text-sm font-medium">
                                  {mapping.destinationColumn}
                                </span>
                              )}
                              <Badge className={getDataTypeBadge(mapping.destinationType || 'TEXT')}>
                                {mapping.destinationType}
                              </Badge>

                              {/* Transformations Popover - Available for all mapped columns */}
                              {transformationsByCategory && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1">
                                      <Wand2 className="w-3 h-3" />
                                      Transforms
                                      {(mapping.transformations?.length || 0) > 0 && (
                                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                          {mapping.transformations?.length}
                                        </Badge>
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" align="start">
                                    <div className="space-y-3">
                                      <div>
                                        <h4 className="font-medium text-sm mb-2">Apply Transformations</h4>
                                        <p className="text-xs text-muted-foreground">
                                          Select transformations to apply in order
                                        </p>
                                      </div>
                                      <div className="max-h-64 overflow-y-auto space-y-3">
                                        {Object.entries(transformationsByCategory).map(([category, transforms]) => (
                                          <div key={category} className="space-y-2">
                                            <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                                              {category}
                                            </h5>
                                            {transforms.map((transform) => (
                                              <label
                                                key={transform.name}
                                                className="flex items-start space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                                              >
                                                <Checkbox
                                                  checked={mapping.transformations?.includes(transform.name) || false}
                                                  onCheckedChange={() => handleToggleTransformation(idx, transform.name)}
                                                />
                                                <div className="flex-1">
                                                  <div className="text-sm font-medium">{transform.name}</div>
                                                  <div className="text-xs text-muted-foreground">
                                                    {transform.description}
                                                  </div>
                                                </div>
                                              </label>
                                            ))}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}

                              {/* Unmap button - Only for existing tables */}
                              {!isCreatingNewTable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnmapColumn(idx)}
                                  className="ml-auto"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Select
                                value={mapping.destinationColumn || ''}
                                onValueChange={(value) => handleMapColumn(idx, value)}
                              >
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Select DB column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailableTableColumns().map((col) => (
                                    <SelectItem
                                      key={col.name}
                                      value={col.name}
                                      disabled={!isCreatingNewTable && isMapped(col.name)}
                                    >
                                      {col.name} ({col.type})
                                      {!isCreatingNewTable && isMapped(col.name) && ' - Already mapped'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Badge variant="outline" className="text-muted-foreground">
                                Excluded
                              </Badge>
                            </>
                          )}
                        </>
                      )}

                      {/* For table-only columns - show column name and status badges */}
                      {isTableOnly && (
                        <>
                          {canEditColumnNames ? (
                            <Input
                              value={mapping.destinationColumn}
                              onChange={(e) => {
                                const tableOnlyIdx = tableOnlyColumns.findIndex(c =>
                                  c.destinationColumn === mapping.destinationColumn &&
                                  c.columnOrder === mapping.columnOrder
                                )
                                if (tableOnlyIdx !== -1) {
                                  const updatedTableOnly = [...tableOnlyColumns]
                                  updatedTableOnly[tableOnlyIdx] = {
                                    ...updatedTableOnly[tableOnlyIdx],
                                    destinationColumn: e.target.value,
                                  }
                                  const allMappings = [...csvColumns, ...updatedTableOnly]
                                  onChange(allMappings)
                                }
                              }}
                              className="font-mono text-sm max-w-[200px]"
                              placeholder="column_name"
                            />
                          ) : (
                            <span className="font-mono text-sm font-medium">
                              {mapping.destinationColumn}
                            </span>
                          )}
                          <Badge className={getDataTypeBadge(mapping.destinationType || 'TEXT')}>
                            {mapping.destinationType}
                          </Badge>

                          {/* Status badges */}
                          {hasDefault && !mapping.exclude && (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Auto-filled (default)
                            </Badge>
                          )}
                          {isNullableOnly && !mapping.exclude && (
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Optional (nullable)
                            </Badge>
                          )}
                          {(hasDefault || isNullableOnly) && mapping.exclude && (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Optional - Excluded for truncate & insert
                            </Badge>
                          )}
                          {requiresAction && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Action Required
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {allMappings.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">
                No columns to map
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
