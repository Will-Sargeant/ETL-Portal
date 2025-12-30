import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  Trash2,
  Play,
  Pause,
  Edit,
  Plus,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { schedulesApi, type Schedule, type ScheduleCreate } from '@/lib/api/schedules'

interface ScheduleManagerProps {
  jobId?: number
  showJobName?: boolean
  readOnly?: boolean
  onEdit?: () => void
  isPaused?: boolean
  onPauseToggle?: () => void
}

// Common cron expression presets
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 6 AM', value: '0 6 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every 1st of month', value: '0 0 1 * *' },
  { label: 'Custom', value: 'custom' },
]

export function ScheduleManager({
  jobId,
  showJobName = false,
  readOnly = false,
  onEdit,
  isPaused = false,
  onPauseToggle
}: ScheduleManagerProps) {
  const queryClient = useQueryClient()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [cronPreset, setCronPreset] = useState('0 0 * * *')
  const [customCron, setCustomCron] = useState('')
  const [isCustomCron, setIsCustomCron] = useState(false)

  const { data: schedules, isLoading, refetch } = useQuery({
    queryKey: ['schedules', { job_id: jobId }],
    queryFn: () => schedulesApi.list({ job_id: jobId }),
  })

  const createMutation = useMutation({
    mutationFn: ({ jobId, schedule }: { jobId: number; schedule: ScheduleCreate }) =>
      schedulesApi.create(jobId, schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule created successfully')
      setIsCreateDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create schedule'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) =>
      schedulesApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule updated successfully')
      setIsEditDialogOpen(false)
      setSelectedSchedule(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update schedule'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete schedule'
      toast.error(message)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      enabled ? schedulesApi.enable(id) : schedulesApi.disable(id),
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success(`Schedule ${enabled ? 'enabled' : 'disabled'} successfully`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to toggle schedule'
      toast.error(message)
    },
  })

  const resetForm = () => {
    setCronPreset('0 0 * * *')
    setCustomCron('')
    setIsCustomCron(false)
  }

  const handleCreateSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const cronExpression = isCustomCron ? customCron : cronPreset

    if (!cronExpression) {
      toast.error('Please enter a cron expression')
      return
    }

    if (!jobId) {
      toast.error('No job selected')
      return
    }

    createMutation.mutate({
      jobId,
      schedule: {
        cron_expression: cronExpression,
        enabled: true,
      },
    })
  }

  const handleEditSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSchedule) return

    const cronExpression = isCustomCron ? customCron : cronPreset

    updateMutation.mutate({
      id: selectedSchedule.id,
      updates: {
        cron_expression: cronExpression,
      },
    })
  }

  const handleDelete = (schedule: Schedule) => {
    if (confirm(`Are you sure you want to delete this schedule?`)) {
      deleteMutation.mutate(schedule.id)
    }
  }

  const handleToggle = (schedule: Schedule) => {
    toggleMutation.mutate({
      id: schedule.id,
      enabled: !schedule.enabled,
    })
  }

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule)
    // Check if it matches a preset
    const preset = CRON_PRESETS.find(p => p.value === schedule.cron_expression)
    if (preset && preset.value !== 'custom') {
      setCronPreset(preset.value)
      setIsCustomCron(false)
    } else {
      setCustomCron(schedule.cron_expression)
      setIsCustomCron(true)
    }
    setIsEditDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading schedules...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Schedules</CardTitle>
              <CardDescription>
                Manage automated job execution schedules
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              {readOnly && onPauseToggle && schedules && schedules.length > 0 && (
                <Button
                  variant={isPaused ? "default" : "outline"}
                  onClick={onPauseToggle}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Job
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause Job
                    </>
                  )}
                </Button>
              )}
              {readOnly && onEdit ? (
                <Button onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Schedules
                </Button>
              ) : (
                jobId && (
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Schedule
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleCreateSchedule}>
                      <DialogHeader>
                        <DialogTitle>Create Schedule</DialogTitle>
                        <DialogDescription>
                          Set up automated execution for this job
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Schedule Preset</Label>
                          <Select
                            value={isCustomCron ? 'custom' : cronPreset}
                            onValueChange={(value) => {
                              if (value === 'custom') {
                                setIsCustomCron(true)
                              } else {
                                setCronPreset(value)
                                setIsCustomCron(false)
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CRON_PRESETS.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {isCustomCron && (
                          <div className="space-y-2">
                            <Label htmlFor="custom-cron">Custom Cron Expression</Label>
                            <Input
                              id="custom-cron"
                              placeholder="0 0 * * *"
                              value={customCron}
                              onChange={(e) => setCustomCron(e.target.value)}
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Format: minute hour day month weekday
                            </p>
                          </div>
                        )}

                        <div className="p-3 bg-muted rounded-lg text-sm">
                          <p className="font-medium mb-1">Current Expression:</p>
                          <code className="text-xs">
                            {isCustomCron ? customCron || '(not set)' : cronPreset}
                          </code>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                          Create Schedule
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                )
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!schedules || schedules.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No schedules</p>
              <p className="text-sm text-muted-foreground">
                {jobId
                  ? 'This job has no automated schedule'
                  : 'No scheduled jobs found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Clock className="w-8 h-8 text-primary flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {showJobName && (
                          <span className="font-medium">Job #{schedule.job_id}</span>
                        )}
                        <code className="text-sm bg-muted px-2 py-0.5 rounded">
                          {schedule.cron_expression}
                        </code>
                        <Badge
                          className={
                            schedule.enabled
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          }
                        >
                          {schedule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {schedule.last_run && (
                          <span>
                            Last run: {format(new Date(schedule.last_run), 'MMM d, h:mm a')}
                          </span>
                        )}
                        {schedule.next_run && (
                          <span>
                            Next run: {format(new Date(schedule.next_run), 'MMM d, h:mm a')}
                          </span>
                        )}
                        {schedule.airflow_dag_id && (
                          <span className="text-blue-600 dark:text-blue-400">
                            DAG: {schedule.airflow_dag_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(schedule)}
                        disabled={toggleMutation.isPending}
                        title={schedule.enabled ? 'Disable' : 'Enable'}
                      >
                        {schedule.enabled ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(schedule)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleEditSchedule}>
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>
                Update the cron expression for this schedule
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Schedule Preset</Label>
                <Select
                  value={isCustomCron ? 'custom' : cronPreset}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setIsCustomCron(true)
                    } else {
                      setCronPreset(value)
                      setIsCustomCron(false)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRON_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCustomCron && (
                <div className="space-y-2">
                  <Label htmlFor="edit-custom-cron">Custom Cron Expression</Label>
                  <Input
                    id="edit-custom-cron"
                    placeholder="0 0 * * *"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day month weekday
                  </p>
                </div>
              )}

              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Current Expression:</p>
                <code className="text-xs">
                  {isCustomCron ? customCron || '(not set)' : cronPreset}
                </code>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setSelectedSchedule(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Update Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
