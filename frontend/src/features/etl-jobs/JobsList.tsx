import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Database, Trash2, Play, Pause, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import type { ETLJobListItem, JobStatus } from '@/types/etl-job'

interface JobsListProps {
  onViewJob?: (jobId: number) => void
}

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  running: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

export function JobsList({ onViewJob }: JobsListProps) {
  const queryClient = useQueryClient()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['etl-jobs'],
    queryFn: () => etlJobsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => etlJobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etl-jobs'] })
      toast.success('ETL job deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete ETL job'
      toast.error(message)
    },
  })

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete job "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const getSourceIcon = (type: string) => {
    return type === 'csv' ? FileText : Database
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading ETL jobs...</p>
        </CardContent>
      </Card>
    )
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No ETL jobs yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first ETL job to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ETL Jobs</CardTitle>
        <CardDescription>Manage your data transformation jobs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {jobs.map((job) => {
            const SourceIcon = getSourceIcon(job.source_type)

            return (
              <div
                key={job.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <SourceIcon className="w-8 h-8 text-primary flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{job.name}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[job.status]
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {job.description && (
                      <p className="text-sm text-muted-foreground truncate mb-1">
                        {job.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <SourceIcon className="w-3 h-3" />
                        {job.source_type.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {job.destination_type.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  {job.status === 'draft' || job.status === 'paused' ? (
                    <Button variant="ghost" size="icon" title="Activate job" disabled>
                      <Play className="w-4 h-4 text-green-600" />
                    </Button>
                  ) : job.status === 'active' ? (
                    <Button variant="ghost" size="icon" title="Pause job" disabled>
                      <Pause className="w-4 h-4" />
                    </Button>
                  ) : null}

                  {onViewJob && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewJob(job.id)}
                      title="View details"
                    >
                      View
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(job.id, job.name)}
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
  )
}
