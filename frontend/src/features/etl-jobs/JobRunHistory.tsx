import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  FileText,
  RefreshCw,
  Filter
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { jobRunsApi, type JobRunFilters } from '@/lib/api/job-runs'
import type { JobRunResponse } from '@/types/schedule'

interface JobRunHistoryProps {
  jobId?: number
  showJobName?: boolean
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle2,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'Failed',
  },
  retrying: {
    icon: RefreshCw,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    label: 'Retrying',
  },
}

export function JobRunHistory({ jobId, showJobName = false }: JobRunHistoryProps) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<JobRunFilters>({ job_id: jobId, limit: 50 })
  const [selectedRun, setSelectedRun] = useState<number | null>(null)
  const [showLogsDialog, setShowLogsDialog] = useState(false)

  const { data: jobRuns, isLoading, refetch } = useQuery({
    queryKey: ['job-runs', filters],
    queryFn: () => jobRunsApi.list(filters),
    refetchInterval: (query) => {
      // Auto-refresh if any runs are in pending, running, or retrying state
      const hasActiveRuns = Array.isArray(query.state.data) && query.state.data.some(run =>
        run.status === 'pending' || run.status === 'running' || run.status === 'retrying'
      )
      return hasActiveRuns ? 3000 : false // Poll every 3 seconds if active runs exist
    },
  })

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['job-run-logs', selectedRun],
    queryFn: () => jobRunsApi.getLogs(selectedRun!),
    enabled: !!selectedRun && showLogsDialog,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => jobRunsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-runs'] })
      toast.success('Job run deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete job run'
      toast.error(message)
    },
  })

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this job run?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleViewLogs = (runId: number) => {
    setSelectedRun(runId)
    setShowLogsDialog(true)
  }

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status as JobRunFilters['status'],
    }))
  }

  const calculateDuration = (run: JobRunResponse) => {
    if (!run.completed_at) return null
    const start = new Date(run.started_at)
    const end = new Date(run.completed_at)
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading job run history...</p>
        </CardContent>
      </Card>
    )
  }

  if (!jobRuns || jobRuns.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No execution history</p>
          <p className="text-sm text-muted-foreground">
            {jobId
              ? 'This job has not been executed yet'
              : 'No jobs have been executed yet'}
          </p>
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
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                {jobId
                  ? 'View all executions for this job'
                  : 'View all job executions across the system'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={handleStatusFilter} defaultValue="all">
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="retrying">Retrying</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobRuns.map((run) => {
              const statusConfig = STATUS_CONFIG[run.status]
              const StatusIcon = statusConfig.icon
              const duration = calculateDuration(run)

              return (
                <div
                  key={run.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusIcon
                      className={`w-8 h-8 flex-shrink-0 ${
                        run.status === 'running' || run.status === 'retrying' ? 'animate-spin' : ''
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {showJobName && (
                          <span className="font-medium text-sm">Job #{run.job_id}</span>
                        )}
                        <Badge className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                        {run.status === 'running' && run.rows_processed && run.rows_processed > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {run.rows_processed.toLocaleString()} rows processed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Started {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                        </span>
                        {run.completed_at && duration && (
                          <span>Duration: {duration}</span>
                        )}
                        {run.status === 'completed' && run.rows_processed && (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {run.rows_processed.toLocaleString()} rows
                          </span>
                        )}
                        {run.status === 'failed' && run.rows_failed && run.rows_failed > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {run.rows_failed.toLocaleString()} failed
                          </span>
                        )}
                      </div>

                      {run.message && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {run.message}
                        </p>
                      )}

                      {run.completed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {format(new Date(run.completed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewLogs(run.id)}
                      title="View logs"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Logs
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(run.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution Logs</DialogTitle>
            <DialogDescription>
              Job Run #{selectedRun}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs ? (
              <>
                {logs.error_message && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <h4 className="font-semibold text-red-900 dark:text-red-400 mb-2">
                      Error Message
                    </h4>
                    <pre className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                      {logs.error_message}
                    </pre>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Execution Logs</h4>
                  <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {logs.logs || 'No logs available'}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Status: {logs.status}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(logs.logs || '')
                      toast.success('Logs copied to clipboard')
                    }}
                  >
                    Copy Logs
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
