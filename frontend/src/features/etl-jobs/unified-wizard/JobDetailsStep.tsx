/**
 * Step 2: Job Details
 * Configure job name, description, and batch size
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersApi } from '@/lib/api/users'
import type { WizardState } from './types'

interface JobDetailsStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
  isEditMode?: boolean
}

export function JobDetailsStep({ state, onUpdate, isEditMode = false }: JobDetailsStepProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Fetch users list (admin only)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  // Set default assigned user to current admin if not already set (create mode only)
  useEffect(() => {
    if (!isEditMode && isAdmin && user?.id && !state.assignedUserId) {
      onUpdate({ assignedUserId: user.id })
    }
  }, [isEditMode, isAdmin, user?.id, state.assignedUserId, onUpdate])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Job Details</h2>
        <p className="text-muted-foreground mt-1">
          Configure the basic settings for your ETL job
        </p>
      </div>

      <div className="grid gap-6">
        {/* Job Name */}
        <Card>
          <CardHeader>
            <CardTitle>Job Information</CardTitle>
            <CardDescription>
              Provide a name and optional description for this job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-name">
                Job Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="job-name"
                placeholder="My ETL Job"
                value={state.jobName}
                onChange={(e) => onUpdate({ jobName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this job
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-description">Description</Label>
              <Textarea
                id="job-description"
                placeholder="Optional description of what this job does"
                value={state.jobDescription}
                onChange={(e) => onUpdate({ jobDescription: e.target.value })}
                rows={3}
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="assign-to">Assign To</Label>
                <Select
                  value={state.assignedUserId?.toString() || ''}
                  onValueChange={(value) => onUpdate({ assignedUserId: parseInt(value) })}
                >
                  <SelectTrigger id="assign-to">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.email} {u.full_name ? `(${u.full_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign this job to a specific user
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Load Strategy */}
        <Card>
          <CardHeader>
            <CardTitle>Load Strategy</CardTitle>
            <CardDescription>
              Choose how data should be loaded into the destination table
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={state.loadStrategy}
              onValueChange={(value: 'insert' | 'upsert' | 'truncate_insert') => onUpdate({ loadStrategy: value })}
            >
              <div className="space-y-3">
                {/* INSERT */}
                <label
                  htmlFor="insert"
                  className={`flex items-start space-x-3 p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors ${
                    state.loadStrategy === 'insert' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <RadioGroupItem value="insert" id="insert" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Insert (Append)</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Appends new rows to the table. Best for incremental data loads. Auto-adds new columns if needed.
                    </p>
                  </div>
                </label>

                {/* UPSERT */}
                <label
                  htmlFor="upsert"
                  className={`flex items-start space-x-3 p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors ${
                    state.loadStrategy === 'upsert' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <RadioGroupItem value="upsert" id="upsert" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Upsert (Insert or Update)</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Inserts new rows or updates existing rows based on unique keys. Requires exact schema match and upsert key configuration.
                    </p>
                  </div>
                </label>

                {/* TRUNCATE_INSERT */}
                <label
                  htmlFor="truncate_insert"
                  className={`flex items-start space-x-3 p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors ${
                    state.loadStrategy === 'truncate_insert' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <RadioGroupItem value="truncate_insert" id="truncate_insert" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Truncate & Insert (Replace All)</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drops and recreates the table, then inserts all data. Best for full data refreshes. Allows schema changes.
                    </p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Batch Size */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Configuration</CardTitle>
            <CardDescription>
              Configure how data is processed during the ETL operation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-size">
                Batch Size <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-size"
                type="number"
                min={100}
                max={100000}
                step={100}
                value={state.batchSize}
                onChange={(e) => onUpdate({ batchSize: parseInt(e.target.value) || 10000 })}
              />
              <p className="text-xs text-muted-foreground">
                Number of rows to process in each batch (100 - 100,000). Default: 10,000
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
