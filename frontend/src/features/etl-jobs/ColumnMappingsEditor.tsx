import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Edit2, Save, X, Trash2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import { getTransformationsByCategory, getCategoryDisplayName } from '@/lib/transformations'
import type { ETLJob, ColumnMapping } from '@/types/etl-job'

interface ColumnMappingsEditorProps {
  job?: ETLJob
  wizardMode?: boolean
  columnMappings?: ColumnMapping[]
  onMappingsChange?: (mappings: ColumnMapping[]) => void
}

const DATA_TYPES = [
  'text',
  'varchar',
  'integer',
  'bigint',
  'numeric',
  'decimal',
  'boolean',
  'date',
  'timestamp',
  'json',
  'jsonb',
]

export function ColumnMappingsEditor({
  job,
  wizardMode = false,
  columnMappings: wizardMappings,
  onMappingsChange,
}: ColumnMappingsEditorProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editedMapping, setEditedMapping] = useState<ColumnMapping | null>(null)

  // Get column mappings - either from wizard props or job
  const columnMappings = wizardMode ? (wizardMappings || []) : (job?.column_mappings || [])

  // Reset editing state when column mappings change (e.g., when user goes back and selects a different table)
  useEffect(() => {
    if (wizardMode && editingId !== null) {
      // In wizard mode, clear editing state when mappings change from parent
      setEditingId(null)
      setEditedMapping(null)
    }
  }, [wizardMappings, wizardMode])

  // Get transformations grouped by category
  const transformationsByCategory = useMemo(() => getTransformationsByCategory(), [])
  const isLoadingTransformations = false

  const updateMutation = useMutation({
    mutationFn: async (mappings: ColumnMapping[]) => {
      // Update column mappings via API (only in non-wizard mode)
      if (!wizardMode && job) {
        return etlJobsApi.updateMappings(job.id, mappings)
      }
      return mappings
    },
    onSuccess: (mappings) => {
      if (wizardMode) {
        // In wizard mode, call the callback
        onMappingsChange?.(mappings)
      } else if (job) {
        // In regular mode, invalidate queries
        queryClient.invalidateQueries({ queryKey: ['etl-job', job.id.toString()] })
        toast.success('Column mappings updated successfully!')
      }
      setEditingId(null)
      setEditedMapping(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update column mappings'
      toast.error(message)
    },
  })

  const handleEdit = (mapping: ColumnMapping) => {
    setEditingId(mapping.id || null)
    // Ensure transformations is an array
    const transformations = mapping.transformations || (mapping.transformation ? [mapping.transformation] : [])
    setEditedMapping({ ...mapping, transformations })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditedMapping(null)
  }

  const handleSave = () => {
    if (!editedMapping) return

    const updatedMappings = columnMappings.map(m =>
      m.id === editingId ? editedMapping : m
    )
    updateMutation.mutate(updatedMappings)
  }

  const handleDelete = (mappingId: number | undefined) => {
    if (!mappingId && !wizardMode) return

    if (confirm('Are you sure you want to delete this column mapping?')) {
      const updatedMappings = wizardMode
        ? columnMappings.filter((m, idx) => idx !== editingId)
        : columnMappings.filter(m => m.id !== mappingId)
      updateMutation.mutate(updatedMappings)
    }
  }

  const updateField = (field: keyof ColumnMapping, value: any) => {
    if (!editedMapping) return
    setEditedMapping({ ...editedMapping, [field]: value })
  }


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
      json: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      jsonb: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    }
    return colors[dataType.toLowerCase()] || colors.text
  }

  if (!columnMappings || columnMappings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Column Mappings</CardTitle>
          <CardDescription>No column mappings configured for this job</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Column mappings are created during job configuration. Edit the job to add column mappings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Column Mappings & Transformations</CardTitle>
            <CardDescription>
              View and edit how source columns are mapped and transformed for the destination
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {columnMappings.map((mapping, idx) => {
            const isEditing = editingId === mapping.id
            const currentMapping = isEditing ? editedMapping! : mapping

            return (
              <div
                key={mapping.id || idx}
                className={`border rounded-lg p-4 ${
                  mapping.exclude ? 'bg-muted/30 opacity-60' : ''
                }`}
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source Column */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Source Column {!currentMapping.source_column && '(No CSV source)'}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={currentMapping.source_column || 'N/A - Table column only'}
                            disabled
                            className="font-mono text-sm"
                          />
                          {currentMapping.source_column && (
                            <Badge className={getDataTypeBadge(currentMapping.source_type)}>
                              {currentMapping.source_type}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Destination Column */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Destination Column</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={currentMapping.destination_column}
                            onChange={(e) => updateField('destination_column', e.target.value)}
                            className="font-mono text-sm"
                          />
                          <Select
                            value={currentMapping.destination_type}
                            onValueChange={(value) => updateField('destination_type', value)}
                          >
                            <SelectTrigger className="w-32">
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
                      </div>
                    </div>

                    {/* Transformations (Multi-select with Categories) */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Transformations (applied in order)
                      </Label>
                      {isLoadingTransformations ? (
                        <div className="p-3 border rounded-lg text-sm text-muted-foreground">
                          Loading transformations...
                        </div>
                      ) : transformationsByCategory ? (
                        <div className="max-h-80 overflow-y-auto border rounded-lg p-3 space-y-3">
                          {Object.entries(transformationsByCategory).map(([category, transformations]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="font-medium text-sm capitalize">{category}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                                {transformations.map((t) => {
                                  const isSelected = currentMapping.transformations?.includes(t.name) || false
                                  return (
                                    <div key={t.name} className="flex items-start space-x-2">
                                      <Checkbox
                                        id={`transform-${mapping.id}-${t.name}`}
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          const current = currentMapping.transformations || []
                                          if (checked) {
                                            updateField('transformations', [...current, t.name])
                                          } else {
                                            updateField('transformations', current.filter(v => v !== t.name))
                                          }
                                        }}
                                      />
                                      <div className="flex-1">
                                        <Label
                                          htmlFor={`transform-${mapping.id}-${t.name}`}
                                          className="text-sm font-normal cursor-pointer"
                                        >
                                          {t.name}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">{t.description}</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 border rounded-lg text-sm text-muted-foreground">
                          No transformations available
                        </div>
                      )}
                      {currentMapping.transformations && currentMapping.transformations.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Applied in order:</span>
                          {currentMapping.transformations.map((t, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {idx + 1}. {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>


                    {/* Default Value */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Default Value</Label>
                      <Input
                        value={currentMapping.default_value || ''}
                        onChange={(e) => updateField('default_value', e.target.value)}
                        placeholder="Default value for null fields"
                      />
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`nullable-${mapping.id}`}
                          checked={currentMapping.is_nullable}
                          onCheckedChange={(checked) => updateField('is_nullable', checked)}
                        />
                        <Label htmlFor={`nullable-${mapping.id}`} className="text-sm">
                          Nullable
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`primary-${mapping.id}`}
                          checked={currentMapping.is_primary_key || false}
                          onCheckedChange={(checked) => updateField('is_primary_key', checked)}
                        />
                        <Label htmlFor={`primary-${mapping.id}`} className="text-sm">
                          Primary Key
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`exclude-${mapping.id}`}
                          checked={currentMapping.exclude || false}
                          onCheckedChange={(checked) => updateField('exclude', checked)}
                        />
                        <Label htmlFor={`exclude-${mapping.id}`} className="text-sm">
                          Exclude from ETL
                        </Label>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Column Flow */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            {mapping.source_column ? (
                              <>
                                <span className="font-mono text-sm font-medium">
                                  {mapping.source_column}
                                </span>
                                <Badge className={getDataTypeBadge(mapping.source_type)}>
                                  {mapping.source_type}
                                </Badge>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                No CSV source
                              </span>
                            )}
                          </div>

                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {mapping.destination_column}
                            </span>
                            <Badge className={getDataTypeBadge(mapping.destination_type)}>
                              {mapping.destination_type}
                            </Badge>
                          </div>
                        </div>

                        {/* Warning for columns requiring user action */}
                        {(mapping as any).requiresUserAction && !mapping.source_column && (
                          <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                            ⚠️ <strong>Action Required:</strong> This table column requires a value (NOT NULL, no default).
                            Either map it to a CSV column or set a default value.
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {!mapping.source_column && mapping.default_value && (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                              Auto-populated (default)
                            </Badge>
                          )}
                          {!mapping.source_column && !mapping.default_value && mapping.is_nullable && (
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                              Optional (nullable)
                            </Badge>
                          )}
                          {mapping.transformations && mapping.transformations.length > 0 && (
                            <Badge variant="secondary">
                              Transforms: {mapping.transformations.join(' → ')}
                            </Badge>
                          )}
                          {!mapping.transformations && mapping.transformation && (
                            <Badge variant="secondary">
                              Transform: {mapping.transformation}
                            </Badge>
                          )}
                          {mapping.default_value && (
                            <Badge variant="outline">
                              Default: {mapping.default_value}
                            </Badge>
                          )}
                          {mapping.is_nullable ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Nullable
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              NOT NULL
                            </Badge>
                          )}
                          {mapping.is_primary_key && (
                            <Badge variant="default">Primary Key</Badge>
                          )}
                          {mapping.exclude && (
                            <Badge variant="destructive">Excluded</Badge>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(mapping)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(mapping.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
