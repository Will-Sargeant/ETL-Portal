import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, X, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import { credentialsApi } from '@/lib/api/credentials'
import { sourcesApi } from '@/lib/api/sources'
import type { ETLJob, ETLJobUpdate } from '@/types/etl-job'

interface JobEditorProps {
  job: ETLJob
  onCancel: () => void
  onSave: () => void
}

export function JobEditor({ job, onCancel, onSave }: JobEditorProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<ETLJobUpdate>({
    name: job.name || '',
    description: job.description || '',
    destination_config: {
      credential_id: job.destination_config?.credential_id,
      schema: job.destination_config?.schema || '',
      table_name: job.destination_config?.table_name || job.destination_config?.table || '',
      ...job.destination_config,
    },
    load_strategy: job.load_strategy || 'insert',
    batch_size: job.batch_size || 10000,
    source_config: {
      file_id: job.source_config?.file_id || '',
      file_path: job.source_config?.file_path || '',
      ...job.source_config,
    },
  })
  const [uploadingCSV, setUploadingCSV] = useState(false)

  const { data: credentials } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  const updateMutation = useMutation({
    mutationFn: () => etlJobsApi.update(job.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etl-job', job.id.toString()] })
      queryClient.invalidateQueries({ queryKey: ['etl-jobs'] })
      toast.success('Job updated successfully!')
      onSave()
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update job'
      toast.error(message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate()
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCSV(true)
    try {
      const uploadResponse = await sourcesApi.uploadCSV(file)

      setFormData(prev => ({
        ...prev,
        source_config: {
          ...prev.source_config,
          file_path: uploadResponse.file_path,
          file_id: uploadResponse.file_id,
        },
      }))

      toast.success('CSV file uploaded successfully!')
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to upload CSV'
      toast.error(message)
    } finally {
      setUploadingCSV(false)
    }
  }

  const updateField = (field: keyof ETLJobUpdate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateDestinationConfig = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      destination_config: {
        ...prev.destination_config,
        [field]: value,
      },
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Update job name and description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Job Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="My ETL Job"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe what this job does..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Source Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Source Configuration</CardTitle>
          <CardDescription>Update CSV source file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-upload">Upload New CSV File</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={uploadingCSV}
                className="flex-1"
              />
              {uploadingCSV && <Upload className="w-4 h-4 animate-pulse" />}
            </div>
            {formData.source_config?.file_id && (
              <p className="text-sm text-muted-foreground mt-2">
                Current file ID: {formData.source_config.file_id}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Destination Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Destination Configuration</CardTitle>
          <CardDescription>Update database connection and table settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="credential">Database Credential *</Label>
            <Select
              value={formData.destination_config?.credential_id?.toString()}
              onValueChange={(value) =>
                updateDestinationConfig('credential_id', parseInt(value))
              }
            >
              <SelectTrigger id="credential">
                <SelectValue placeholder="Select credential" />
              </SelectTrigger>
              <SelectContent>
                {credentials?.map((cred) => (
                  <SelectItem key={cred.id} value={cred.id.toString()}>
                    {cred.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="schema">Schema</Label>
              <Input
                id="schema"
                value={formData.destination_config?.schema || ''}
                onChange={(e) => updateDestinationConfig('schema', e.target.value)}
                placeholder="public"
              />
            </div>

            <div>
              <Label htmlFor="table">Table Name *</Label>
              <Input
                id="table"
                value={formData.destination_config?.table_name || formData.destination_config?.table || ''}
                onChange={(e) => {
                  updateDestinationConfig('table_name', e.target.value)
                  updateDestinationConfig('table', e.target.value)
                }}
                placeholder="my_table"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="load_strategy">Load Strategy *</Label>
            <Select
              value={formData.load_strategy}
              onValueChange={(value) => updateField('load_strategy', value)}
            >
              <SelectTrigger id="load_strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insert">INSERT - Append new rows</SelectItem>
                <SelectItem value="upsert">UPSERT - Insert or update on conflict</SelectItem>
                <SelectItem value="truncate_insert">
                  TRUNCATE & INSERT - Replace all data
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="batch_size">Batch Size</Label>
            <Input
              id="batch_size"
              type="number"
              value={formData.batch_size}
              onChange={(e) => updateField('batch_size', parseInt(e.target.value))}
              min={100}
              max={100000}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of rows to process per batch (100 - 100,000)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
