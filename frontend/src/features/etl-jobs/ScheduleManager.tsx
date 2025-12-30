import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Edit,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { schedulesApi, type Schedule } from '@/lib/api/schedules'

interface ScheduleManagerProps {
  jobId?: number
  showJobName?: boolean
  readOnly?: boolean
  onEdit?: () => void
  isPaused?: boolean
  onPauseToggle?: () => void
}

export function ScheduleManager({
  jobId,
  showJobName = false,
  readOnly = false,
  onEdit,
  isPaused = false,
  onPauseToggle
}: ScheduleManagerProps) {
  const queryClient = useQueryClient()

  const { data: schedules, isLoading, refetch } = useQuery({
    queryKey: ['schedules', { job_id: jobId }],
    queryFn: () => schedulesApi.list({ job_id: jobId }),
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

  const handleToggle = (schedule: Schedule) => {
    toggleMutation.mutate({
      id: schedule.id,
      enabled: !schedule.enabled,
    })
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
            {readOnly && onEdit && (
              <Button onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Schedules
              </Button>
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
