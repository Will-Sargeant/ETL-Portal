/**
 * Unified Job Wizard Page
 * Full-page container for the ETL job creation wizard
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UnifiedJobWizard } from '@/features/etl-jobs/unified-wizard/UnifiedJobWizard'

export function UnifiedJobWizardPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/jobs')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create ETL Job</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure and create a new ETL job with step-by-step guidance
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Content */}
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <UnifiedJobWizard />
      </div>
    </div>
  )
}
