import { useState } from 'react'
import { GripVertical, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CalculatedColumnBuilder } from './CalculatedColumnBuilder'
import type { ColumnMappingConfig } from '@/types/source'
import type { ColumnInfo } from '@/types/source'
import type { TableSchema } from '@/types/destination'

interface ColumnMappingEditorProps {
  sourceColumns: ColumnInfo[]
  tableSchema: TableSchema | null
  value: ColumnMappingConfig[]
  onChange: (mappings: ColumnMappingConfig[]) => void
}

const SQL_TYPES = [
  'TEXT',
  'VARCHAR(255)',
  'INTEGER',
  'BIGINT',
  'NUMERIC',
  'DECIMAL(18,2)',
  'TIMESTAMP',
  'DATE',
  'BOOLEAN',
  'JSON',
]

const TRANSFORMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'UPPER', label: 'UPPER' },
  { value: 'LOWER', label: 'LOWER' },
  { value: 'TRIM', label: 'TRIM' },
  { value: 'LTRIM', label: 'LTRIM' },
  { value: 'RTRIM', label: 'RTRIM' },
]

export function ColumnMappingEditor({
  sourceColumns,
  tableSchema,
  value,
  onChange,
}: ColumnMappingEditorProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showCalculatedBuilder, setShowCalculatedBuilder] = useState(false)

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  const handleAutoMapAll = () => {
    // Auto-map all columns by name matching
    const updated = value.map((mapping, index) => {
      const sourceColumn = sourceColumns[index]
      const matchedColumn = tableSchema?.columns.find(
        (col) => col.name.toLowerCase() === sourceColumn.name.toLowerCase()
      )

      if (matchedColumn) {
        return {
          ...mapping,
          destinationColumn: matchedColumn.name,
          destinationType: matchedColumn.data_type,
          exclude: false,
        }
      }
      return mapping
    })
    onChange(updated)
  }

  const handleResetAll = () => {
    const reset = value.map((mapping) => ({
      ...mapping,
      destinationColumn: null,
      destinationType: null,
      transformation: undefined,
      exclude: false,
      defaultValue: undefined,
    }))
    onChange(reset)
  }

  const handleExcludeUnmapped = () => {
    const updated = value.map((mapping) => ({
      ...mapping,
      exclude: !mapping.destinationColumn,
    }))
    onChange(updated)
  }

  const handleAddCalculatedColumn = (column: ColumnMappingConfig) => {
    onChange([...value, column])
  }

  const getExistingColumnNames = (): string[] => {
    return value
      .map((m) => m.destinationColumn)
      .filter((name): name is string => !!name)
  }

  const getNextColumnOrder = (): number => {
    return value.length > 0 ? Math.max(...value.map((m) => m.columnOrder || 0)) + 1 : 0
  }

  const updateMapping = (index: number, updates: Partial<ColumnMappingConfig>) => {
    const updated = [...value]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const moveMapping = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= value.length) return

    const updated = [...value]
    const [movedItem] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, movedItem)

    // Update column order
    updated.forEach((mapping, idx) => {
      mapping.columnOrder = idx
    })

    onChange(updated)
  }

  const getTypeCompatibility = (sourceType: string, destType: string | null): 'good' | 'warning' | 'error' => {
    if (!destType) return 'error'

    const source = sourceType.toLowerCase()
    const dest = destType.toLowerCase()

    // Good matches
    if (source === 'text' && (dest.includes('text') || dest.includes('varchar'))) return 'good'
    if (source === 'number' && (dest.includes('int') || dest.includes('numeric') || dest.includes('decimal'))) return 'good'
    if (source === 'date' && (dest.includes('timestamp') || dest.includes('date'))) return 'good'
    if (source === 'boolean' && dest.includes('boolean')) return 'good'

    // Warning - possible with transformation
    if (source === 'text') return 'warning'

    return 'error'
  }

  const getCompatibilityColor = (level: 'good' | 'warning' | 'error') => {
    switch (level) {
      case 'good':
        return 'text-green-600 dark:text-green-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
    }
  }

  const getCompatibilityIcon = (level: 'good' | 'warning' | 'error') => {
    switch (level) {
      case 'good':
        return '✓'
      case 'warning':
        return '⚠'
      case 'error':
        return '✗'
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAutoMapAll}
          disabled={!tableSchema}
        >
          Auto-Map All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetAll}
        >
          Reset All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExcludeUnmapped}
        >
          Exclude Unmapped
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setShowCalculatedBuilder(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Calculated Column
        </Button>
      </div>

      {/* Column Mappings */}
      <div className="border rounded-lg overflow-hidden">
        {value.map((mapping, index) => {
          const sourceColumn = sourceColumns[index]
          const isExpanded = expandedRows.has(index)
          const compatibility = getTypeCompatibility(
            mapping.sourceType,
            mapping.destinationType
          )

          return (
            <div
              key={index}
              className={`border-b last:border-b-0 ${
                mapping.exclude ? 'bg-muted/30 opacity-60' : 'bg-background'
              }`}
            >
              {/* Main Row */}
              <div className="flex items-center gap-2 p-3 hover:bg-muted/20">
                {/* Drag Handle */}
                <div className="flex flex-col gap-0.5 cursor-move">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => moveMapping(index, index - 1)}
                    disabled={index === 0}
                  >
                    <ChevronDown className="h-3 w-3 rotate-180" />
                  </Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => moveMapping(index, index + 1)}
                    disabled={index === value.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                {/* Expand/Collapse */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleRow(index)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>

                {/* Source Column */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm truncate">
                      {sourceColumn.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded">
                      {mapping.sourceType}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-muted-foreground">→</span>

                {/* Destination Column (Quick Edit) */}
                <div className="flex-1 min-w-0">
                  {!mapping.exclude ? (
                    <Input
                      value={mapping.destinationColumn || ''}
                      onChange={(e) =>
                        updateMapping(index, { destinationColumn: e.target.value })
                      }
                      placeholder="destination_column"
                      className="h-8 font-mono text-sm"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      (excluded)
                    </span>
                  )}
                </div>

                {/* Type (Quick Edit) */}
                <div className="w-32">
                  {!mapping.exclude && (
                    <Select
                      value={mapping.destinationType || ''}
                      onValueChange={(value) =>
                        updateMapping(index, { destinationType: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SQL_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Compatibility Badge */}
                {!mapping.exclude && (
                  <div
                    className={`text-lg ${getCompatibilityColor(compatibility)}`}
                    title={
                      compatibility === 'good'
                        ? 'Compatible types'
                        : compatibility === 'warning'
                        ? 'May need transformation'
                        : 'Incompatible types'
                    }
                  >
                    {getCompatibilityIcon(compatibility)}
                  </div>
                )}

                {/* Exclude Checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`exclude-${index}`}
                    checked={mapping.exclude}
                    onCheckedChange={(checked) =>
                      updateMapping(index, { exclude: checked === true })
                    }
                  />
                  <Label
                    htmlFor={`exclude-${index}`}
                    className="text-xs cursor-pointer"
                  >
                    Exclude
                  </Label>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && !mapping.exclude && (
                <div className="p-4 bg-muted/10 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Transformation</Label>
                      <Select
                        value={mapping.transformation || 'none'}
                        onValueChange={(value) =>
                          updateMapping(index, {
                            transformation: value === 'none' ? undefined : value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMATIONS.map((tf) => (
                            <SelectItem key={tf.value} value={tf.value}>
                              {tf.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Default Value</Label>
                      <Input
                        value={mapping.defaultValue || ''}
                        onChange={(e) =>
                          updateMapping(index, {
                            defaultValue: e.target.value || undefined,
                          })
                        }
                        placeholder="NULL"
                        className="h-8"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`nullable-${index}`}
                        checked={mapping.isNullable}
                        onCheckedChange={(checked) =>
                          updateMapping(index, { isNullable: checked === true })
                        }
                      />
                      <Label
                        htmlFor={`nullable-${index}`}
                        className="text-xs cursor-pointer"
                      >
                        Allow NULL values
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`pk-${index}`}
                        checked={mapping.isPrimaryKey || false}
                        onCheckedChange={(checked) =>
                          updateMapping(index, { isPrimaryKey: checked === true })
                        }
                      />
                      <Label
                        htmlFor={`pk-${index}`}
                        className="text-xs cursor-pointer font-medium"
                      >
                        Primary Key
                      </Label>
                    </div>
                  </div>

                  {/* Sample Values */}
                  {sourceColumn.sample_values.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Sample Values
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {sourceColumn.sample_values.slice(0, 5).map((val, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-muted rounded font-mono"
                          >
                            {val === null ? 'NULL' : String(val)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {value.filter((m) => m.destinationColumn && !m.exclude).length} of{' '}
        {value.length} columns mapped •{' '}
        {value.filter((m) => m.exclude).length} excluded •{' '}
        {value.filter((m) => m.isCalculated).length} calculated
      </div>

      {/* Calculated Column Builder Dialog */}
      <CalculatedColumnBuilder
        open={showCalculatedBuilder}
        onOpenChange={setShowCalculatedBuilder}
        onAdd={handleAddCalculatedColumn}
        existingColumnNames={getExistingColumnNames()}
        nextColumnOrder={getNextColumnOrder()}
      />
    </div>
  )
}
