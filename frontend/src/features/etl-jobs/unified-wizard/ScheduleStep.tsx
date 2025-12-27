/**
 * Step 5: Schedule Configuration (Optional)
 * Configure when the ETL job should run automatically
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon } from 'lucide-react'
import { CronScheduleBuilder } from '@/features/etl-jobs/CronScheduleBuilder'
import type { ScheduleConfig } from '@/types/schedule'
import type { WizardState } from './types'

interface ScheduleStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
}

export function ScheduleStep({ state, onUpdate }: ScheduleStepProps) {
  const handleScheduleChange = (config: ScheduleConfig | null) => {
    onUpdate({ schedule: config })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Schedule Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Optionally configure when this job should run automatically
        </p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          This step is optional. You can skip scheduling now and configure it later from the job
          details page, or run the job manually whenever needed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Job Schedule</CardTitle>
          <CardDescription>
            Choose a schedule preset or enter a custom cron expression
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CronScheduleBuilder value={state.schedule} onChange={handleScheduleChange} />
        </CardContent>
      </Card>

      {state.schedule && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cron Expression:</span>
                <span className="font-mono font-medium">{state.schedule.cronExpression}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={state.schedule.enabled ? 'text-green-600' : 'text-gray-500'}>
                  {state.schedule.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
