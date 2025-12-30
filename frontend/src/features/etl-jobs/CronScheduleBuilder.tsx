import { useState } from 'react'
import { Clock } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ScheduleConfig } from '@/types/schedule'

interface CronScheduleBuilderProps {
  value: ScheduleConfig | null
  onChange: (config: ScheduleConfig | null) => void
}

type PresetType = 'every_4_hours' | 'daily' | 'weekly' | 'custom' | 'none'

const PRESETS: Record<Exclude<PresetType, 'custom' | 'none'>, { cron: string; description: string }> = {
  every_4_hours: { cron: '0 */4 * * *', description: 'Every 4 hours' },
  daily: { cron: '0 0 * * *', description: 'Every day at midnight' },
  weekly: { cron: '0 9 * * 1', description: 'Every Monday at 9 AM' },
}

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
  const [preset, setPreset] = useState<PresetType>('none')
  const [customCron, setCustomCron] = useState('0 0 * * *')

  const handlePresetChange = (newPreset: PresetType) => {
    setPreset(newPreset)

    if (newPreset === 'none') {
      onChange(null)
    } else if (newPreset === 'custom') {
      onChange({
        cronExpression: customCron,
        enabled: true,
      })
    } else {
      onChange({
        cronExpression: PRESETS[newPreset].cron,
        enabled: true,
      })
    }
  }

  const handleCustomCronChange = (cron: string) => {
    setCustomCron(cron)
    if (preset === 'custom') {
      onChange({
        cronExpression: cron,
        enabled: true,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="schedule">Schedule Type</Label>
        <Select value={preset} onValueChange={(v: PresetType) => handlePresetChange(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Schedule (Run Manually)</SelectItem>
            <SelectItem value="every_4_hours">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Every 4 hours
              </div>
            </SelectItem>
            <SelectItem value="daily">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Daily (midnight)
              </div>
            </SelectItem>
            <SelectItem value="weekly">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Weekly (Monday 9 AM)
              </div>
            </SelectItem>
            <SelectItem value="custom">Custom Cron Expression</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset !== 'none' && preset !== 'custom' && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm font-medium mb-1">Schedule</p>
          <p className="text-sm text-muted-foreground">{PRESETS[preset].description}</p>
          <p className="text-xs font-mono mt-2 text-muted-foreground">
            Cron: {PRESETS[preset].cron}
          </p>
        </div>
      )}

      {preset === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="custom_cron">Custom Cron Expression</Label>
          <Input
            id="custom_cron"
            placeholder="0 0 * * *"
            value={customCron}
            onChange={(e) => handleCustomCronChange(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Format: minute hour day month weekday
            <br />
            Example: "0 2 * * *" = Every day at 2:00 AM
          </p>
        </div>
      )}

      {value && (
        <div className="p-4 border-l-4 border-primary bg-primary/5 rounded-r-lg">
          <p className="text-sm font-medium mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Active Schedule
          </p>
          <p className="text-sm text-muted-foreground">
            Cron Expression: <span className="font-mono">{value.cronExpression}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Status: {value.enabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      )}
    </div>
  )
}
