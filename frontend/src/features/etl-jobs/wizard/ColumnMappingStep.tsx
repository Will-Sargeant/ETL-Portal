import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowRight } from 'lucide-react'

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
import { Card } from '@/components/ui/card'
import type { ETLJobCreate, ColumnMapping } from '@/types/etl-job'

interface ColumnMappingStepProps {
  data: Partial<ETLJobCreate>
  onChange: (updates: Partial<ETLJobCreate>) => void
}

const DATA_TYPES = [
  'TEXT',
  'VARCHAR',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'NUMERIC',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'JSON',
  'JSONB',
]

export function ColumnMappingStep({ data, onChange }: ColumnMappingStepProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(
    data.column_mappings || [
      {
        source_column: '',
        destination_column: '',
        source_type: 'TEXT',
        destination_type: 'TEXT',
        is_nullable: true,
      },
    ]
  )

  useEffect(() => {
    onChange({ column_mappings: mappings.filter((m) => m.source_column && m.destination_column) })
  }, [mappings])

  const addMapping = () => {
    setMappings([
      ...mappings,
      {
        source_column: '',
        destination_column: '',
        source_type: 'TEXT',
        destination_type: 'TEXT',
        is_nullable: true,
      },
    ])
  }

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    const newMappings = [...mappings]
    newMappings[index] = { ...newMappings[index], ...updates }
    setMappings(newMappings)
  }

  const autoMapColumns = () => {
    // Auto-map by matching column names
    const newMappings = mappings.map((mapping) => {
      if (mapping.source_column && !mapping.destination_column) {
        return {
          ...mapping,
          destination_column: mapping.source_column,
        }
      }
      return mapping
    })
    setMappings(newMappings)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Column Mappings</h3>
          <p className="text-sm text-muted-foreground">
            Map source columns to destination table columns
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={autoMapColumns}>
          Auto-Map Matching Names
        </Button>
      </div>

      <div className="space-y-3">
        {mappings.map((mapping, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Source Column */}
                <div className="col-span-5 space-y-2">
                  <Label className="text-xs">Source Column</Label>
                  <Input
                    placeholder="source_column"
                    value={mapping.source_column}
                    onChange={(e) => updateMapping(index, { source_column: e.target.value })}
                  />
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex justify-center pt-6">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Destination Column */}
                <div className="col-span-5 space-y-2">
                  <Label className="text-xs">Destination Column</Label>
                  <Input
                    placeholder="destination_column"
                    value={mapping.destination_column}
                    onChange={(e) =>
                      updateMapping(index, { destination_column: e.target.value })
                    }
                  />
                </div>

                {/* Delete Button */}
                <div className="col-span-1 flex justify-end pt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMapping(index)}
                    disabled={mappings.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Source Type */}
                <div className="space-y-2">
                  <Label className="text-xs">Source Type</Label>
                  <Select
                    value={mapping.source_type}
                    onValueChange={(value) => updateMapping(index, { source_type: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination Type */}
                <div className="space-y-2">
                  <Label className="text-xs">Destination Type</Label>
                  <Select
                    value={mapping.destination_type}
                    onValueChange={(value) => updateMapping(index, { destination_type: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nullable */}
                <div className="space-y-2">
                  <Label className="text-xs">Nullable</Label>
                  <Select
                    value={mapping.is_nullable ? 'true' : 'false'}
                    onValueChange={(value) =>
                      updateMapping(index, { is_nullable: value === 'true' })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Transformation (Optional)</Label>
                  <Input
                    placeholder="UPPER, LOWER, TRIM..."
                    value={mapping.transformation || ''}
                    onChange={(e) => updateMapping(index, { transformation: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Default Value (Optional)</Label>
                  <Input
                    placeholder="Default if null"
                    value={mapping.default_value || ''}
                    onChange={(e) => updateMapping(index, { default_value: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addMapping} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Column Mapping
      </Button>

      {mappings.filter((m) => m.source_column && m.destination_column).length === 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">
            At least one column mapping is required to proceed
          </p>
        </div>
      )}
    </div>
  )
}
