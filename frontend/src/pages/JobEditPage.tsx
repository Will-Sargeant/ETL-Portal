/**
 * Job Edit Page
 * Full-page wizard-style editor for modifying existing ETL jobs
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UnifiedJobWizard } from '@/features/etl-jobs/unified-wizard/UnifiedJobWizard'
import { etlJobsApi } from '@/lib/api/etl-jobs'

export function JobEditPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const { data: job, isLoading } = useQuery({
    queryKey: ['etl-job', jobId],
    queryFn: () => etlJobsApi.get(Number(jobId)),
    enabled: !!jobId,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading job...</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Job not found</p>
          <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/jobs/${jobId}`)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit ETL Job</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Modify job configuration with step-by-step guidance
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Content */}
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <UnifiedJobWizard existingJob={job} mode="edit" />
      </div>
    </div>
  )
}
