import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ScheduleConfig } from '@/types/source'
import { CronScheduleBuilder } from '../etl-jobs/CronScheduleBuilder'

interface ScheduleConfigStepProps {
  schedule: ScheduleConfig | null
  batchSize: number
  onScheduleChange: (schedule: ScheduleConfig | null) => void
  onBatchSizeChange: (size: number) => void
}

export function ScheduleConfigStep({
  schedule,
  batchSize,
  onScheduleChange,
  onBatchSizeChange,
}: ScheduleConfigStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Schedule Configuration</h3>
        <CronScheduleBuilder value={schedule} onChange={onScheduleChange} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Batch Configuration</h3>
        <div className="space-y-2">
          <Label htmlFor="batch-size">Batch Size</Label>
          <Input
            id="batch-size"
            type="number"
            value={batchSize}
            onChange={(e) => onBatchSizeChange(parseInt(e.target.value, 10))}
            min={100}
            max={100000}
          />
          <p className="text-sm text-muted-foreground">
            Number of rows to process in each batch (100-100,000)
          </p>
        </div>
      </div>
    </div>
  )
}
