import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Play,
  Pause,
  Calendar,
  Trash2,
  Settings,
  Activity,
  History,
  FileText,
  Edit,
  AlertTriangle
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import { schedulesApi } from '@/lib/api/schedules'
import { JobRunHistory } from '@/features/etl-jobs/JobRunHistory'
import { JobRunProgress } from '@/features/etl-jobs/JobRunProgress'
import { ScheduleManager } from '@/features/etl-jobs/ScheduleManager'
import { SourcePreviewTab } from '@/features/etl-jobs/SourcePreviewTab'
import { ColumnMappingsEditor } from '@/features/etl-jobs/ColumnMappingsEditor'
import type { JobStatus } from '@/types/etl-job'

export function JobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['etl-job', jobId],
    queryFn: () => etlJobsApi.get(Number(jobId)),
    enabled: !!jobId,
  })

  // Query schedules to get the DAG pause status
  const { data: schedules } = useQuery({
    queryKey: ['schedules', { job_id: jobId }],
    queryFn: () => schedulesApi.list({ job_id: Number(jobId) }),
    enabled: !!jobId,
  })

  // Get the first schedule (jobs typically have 0 or 1 schedule)
  const schedule = schedules?.[0]
  // DAG is paused when schedule.enabled is false
  const isDagPaused = schedule ? !schedule.enabled : false

  const STATUS_COLORS: Record<JobStatus, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    running: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paused: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }

  const executeMutation = useMutation({
    mutationFn: () => etlJobsApi.execute(Number(jobId)),
    onSuccess: (jobRun) => {
      queryClient.invalidateQueries({ queryKey: ['job-runs'] })
      toast.success('Job execution started')
      // Switch to the Activity tab to show the progress
      const activityTab = document.querySelector('[data-value="activity"]') as HTMLButtonElement
      activityTab?.click()
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to execute job'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => etlJobsApi.delete(Number(jobId)),
    onSuccess: () => {
      toast.success('Job deleted successfully')
      navigate('/jobs')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete job'
      toast.error(message)
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => etlJobsApi.pause(Number(jobId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etl-job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['etl-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Job paused successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to pause job'
      toast.error(message)
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => etlJobsApi.resume(Number(jobId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etl-job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['etl-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Job resumed successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to resume job'
      toast.error(message)
    },
  })

  const handleExecuteClick = () => {
    setExecuteDialogOpen(true)
  }

  const handleConfirmExecute = () => {
    executeMutation.mutate()
    setExecuteDialogOpen(false)
  }

  const handleCancelExecute = () => {
    setExecuteDialogOpen(false)
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    deleteMutation.mutate()
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Job not found</p>
            <Button onClick={() => navigate('/jobs')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Jobs
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/jobs')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{job.name}</h1>
            {job.description && (
              <p className="text-muted-foreground">{job.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/jobs/${jobId}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Job
            </Button>
            <Button
              onClick={handleExecuteClick}
              disabled={executeMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Now
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Job Info Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Job Configuration</CardTitle>
              <CardDescription>ETL job settings and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[job.status]}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </Badge>
                    {job.is_paused && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <Pause className="w-3 h-3 mr-1" />
                        Paused
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Source Type</p>
                  <p className="font-medium">{job.source_type.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Destination Type</p>
                  <p className="font-medium">{job.destination_type.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Load Strategy</p>
                  <p className="font-medium">{job.load_strategy.toUpperCase().replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Batch Size</p>
                  <p className="font-medium">{job.batch_size.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Created</p>
                  <p className="font-medium">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {job.destination_config && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Destination Configuration</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {job.destination_config.schema && (
                      <div>
                        <p className="text-xs text-muted-foreground">Schema</p>
                        <p className="font-mono text-sm">{job.destination_config.schema}</p>
                      </div>
                    )}
                    {job.destination_config.table && (
                      <div>
                        <p className="text-xs text-muted-foreground">Table</p>
                        <p className="font-mono text-sm">{job.destination_config.table}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for different views */}
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" />
                Execution History
              </TabsTrigger>
              <TabsTrigger value="activity" data-value="activity">
                <Activity className="w-4 h-4 mr-2" />
                Active Runs
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="preview">
                <FileText className="w-4 h-4 mr-2" />
                {job.source_type === 'google_sheets' ? 'Google Sheets Preview' : 'CSV Preview'}
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Column Mappings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
              <JobRunHistory jobId={Number(jobId)} />
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Job Runs</CardTitle>
                  <CardDescription>
                    Monitor currently running executions in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Active runs will appear here with real-time progress updates.
                    Execute the job to see live monitoring.
                  </p>
                  {/* Active runs will be shown here with JobRunProgress components */}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <ScheduleManager
                jobId={Number(jobId)}
                readOnly={true}
                onEdit={() => navigate(`/jobs/${jobId}/edit?step=4`)}
                isPaused={isDagPaused}
                onPauseToggle={() => {
                  if (isDagPaused) {
                    resumeMutation.mutate()
                  } else {
                    pauseMutation.mutate()
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <SourcePreviewTab job={job} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <ColumnMappingsEditor
                job={job}
                readOnly={true}
                onEdit={() => navigate(`/jobs/${jobId}/edit?step=3`)}
              />
            </TabsContent>
          </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle>Delete ETL Job</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete the job{' '}
              <span className="font-semibold">&quot;{job?.name}&quot;</span>?
              <br />
              <br />
              This action cannot be undone. All associated schedules, column mappings, and execution history will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execute Confirmation Dialog */}
      <AlertDialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <Play className="w-5 h-5" />
              <AlertDialogTitle>Execute Job Now</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to manually trigger the job{' '}
                <span className="font-semibold">&quot;{job?.name}&quot;</span> to execute immediately.
              </p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Source:</span> {job?.source_type.toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">Destination:</span> {job?.destination_type.toUpperCase()}
                  {job?.destination_config?.schema && job?.destination_config?.table && (
                    <span className="text-muted-foreground">
                      {' '}({job.destination_config.schema}.{job.destination_config.table})
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-medium">Load Strategy:</span>{' '}
                  <span className={job?.load_strategy === 'truncate_insert' ? 'text-destructive font-semibold' : ''}>
                    {job?.load_strategy.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>

              {job?.load_strategy === 'truncate_insert' && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-destructive">Warning: Destructive Operation</p>
                      <p className="text-muted-foreground mt-1">
                        This will delete all existing data in the destination table before inserting new data.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                The job will run asynchronously via Airflow. You can monitor progress in the Activity tab.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExecute}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExecute}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
