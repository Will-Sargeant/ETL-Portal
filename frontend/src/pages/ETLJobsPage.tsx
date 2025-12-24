import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { JobWizard } from '@/features/etl-jobs/JobWizard'
import { JobsList } from '@/features/etl-jobs/JobsList'

export function ETLJobsPage() {
  const navigate = useNavigate()
  const [showWizard, setShowWizard] = useState(false)

  const handleJobCreated = () => {
    setShowWizard(false)
  }

  const handleViewJob = (jobId: number) => {
    navigate(`/jobs/${jobId}`)
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
          {!showWizard && (
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create ETL Job
            </Button>
          )}
        </div>
      </div>

      {showWizard ? (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setShowWizard(false)}>
            Cancel
          </Button>
          <JobWizard onSuccess={handleJobCreated} />
        </div>
      ) : (
        <JobsList onViewJob={handleViewJob} />
      )}
    </div>
  )
}
