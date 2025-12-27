import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { JobsList } from '@/features/etl-jobs/JobsList'

export function ETLJobsPage() {
  const navigate = useNavigate()

  const handleViewJob = (jobId: number) => {
    navigate(`/jobs/${jobId}`)
  }

  const handleCreateJob = () => {
    navigate('/jobs/new')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">ETL Jobs</h1>
            <p className="text-muted-foreground">
              Create and manage your data transformation pipelines
            </p>
          </div>
          <Button onClick={handleCreateJob}>
            <Plus className="w-4 h-4 mr-2" />
            Create ETL Job
          </Button>
        </div>
      </div>

      <JobsList onViewJob={handleViewJob} />
    </div>
  )
}
