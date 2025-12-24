import { useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useJobRunProgress } from '@/hooks/useJobRunProgress'

interface JobRunProgressProps {
  jobRunId: number
  jobName?: string
  onComplete?: () => void
  onFailed?: () => void
  autoRefreshOnComplete?: boolean
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

export function JobRunProgress({
  jobRunId,
  jobName,
  onComplete,
  onFailed,
  autoRefreshOnComplete = false,
}: JobRunProgressProps) {
  const { progress, isConnected, error } = useJobRunProgress({
    jobRunId,
    enabled: true,
    onComplete: (data) => {
      toast.success(`Job completed successfully! Processed ${data.rows_processed?.toLocaleString() || 0} rows.`)
      if (onComplete) {
        onComplete()
      }
      if (autoRefreshOnComplete) {
        // Refresh the page or parent component
        window.location.reload()
      }
    },
    onFailed: (data) => {
      toast.error(`Job failed: ${data.message || 'Unknown error'}`)
      if (onFailed) {
        onFailed()
      }
    },
    onError: (errorMsg) => {
      toast.error(`Progress stream error: ${errorMsg}`)
    },
  })

  // Show connection status
  useEffect(() => {
    if (isConnected) {
      console.log('Connected to progress stream for job run:', jobRunId)
    }
  }, [isConnected, jobRunId])

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">Failed to load progress</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p>Connecting to job run...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusConfig = STATUS_CONFIG[progress.status as keyof typeof STATUS_CONFIG]
  const StatusIcon = statusConfig?.icon || Clock
  const progressPercentage = progress.progress_percentage || 0
  const rowsProcessed = progress.rows_processed || 0
  const rowsTotal = progress.rows_total || 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StatusIcon
                className={`w-5 h-5 ${progress.status === 'running' || progress.status === 'retrying' ? 'animate-spin' : ''}`}
              />
              {jobName || `Job Run #${jobRunId}`}
            </CardTitle>
            <CardDescription>Real-time execution progress</CardDescription>
          </div>
          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(progress.status === 'running' || progress.status === 'retrying') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {/* Rows Processed */}
        {rowsTotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rows Processed</span>
            <span className="font-medium">
              {rowsProcessed.toLocaleString()} / {rowsTotal.toLocaleString()}
            </span>
          </div>
        )}

        {/* Status Message */}
        {progress.message && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{progress.message}</p>
          </div>
        )}

        {/* Connection Status */}
        {isConnected && (progress.status === 'running' || progress.status === 'retrying') && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live updates
          </div>
        )}

        {/* Retrying Summary */}
        {progress.status === 'retrying' && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <div>
                <p className="font-medium">Task is retrying</p>
                {progress.message && (
                  <p className="text-sm mt-1">{progress.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Completed Summary */}
        {progress.status === 'completed' && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <div>
                <p className="font-medium">Job completed successfully</p>
                <p className="text-sm">
                  Processed {rowsProcessed.toLocaleString()} rows
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Failed Summary */}
        {progress.status === 'failed' && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Job failed</p>
                {progress.message && (
                  <p className="text-sm mt-1">{progress.message}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
