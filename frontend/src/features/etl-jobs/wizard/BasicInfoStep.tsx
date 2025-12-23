import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ETLJobCreate } from '@/types/etl-job'

interface BasicInfoStepProps {
  data: Partial<ETLJobCreate>
  onChange: (updates: Partial<ETLJobCreate>) => void
}

export function BasicInfoStep({ data, onChange }: BasicInfoStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Job Name *</Label>
        <Input
          id="name"
          placeholder="My ETL Job"
          value={data.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
        <p className="text-sm text-muted-foreground">
          A descriptive name for your ETL job
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe what this job does..."
          value={data.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={4}
        />
        <p className="text-sm text-muted-foreground">
          Optional description to help you remember what this job does
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="batch_size">Batch Size</Label>
        <Input
          id="batch_size"
          type="number"
          min="100"
          max="100000"
          value={data.batch_size || 10000}
          onChange={(e) => onChange({ batch_size: parseInt(e.target.value) })}
        />
        <p className="text-sm text-muted-foreground">
          Number of rows to process at a time (100-100,000)
        </p>
      </div>
    </div>
  )
}
