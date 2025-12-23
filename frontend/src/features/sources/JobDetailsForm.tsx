import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface JobDetailsFormProps {
  jobName: string
  jobDescription: string
  onJobNameChange: (name: string) => void
  onJobDescriptionChange: (description: string) => void
  disabled?: boolean
}

export function JobDetailsForm({
  jobName,
  jobDescription,
  onJobNameChange,
  onJobDescriptionChange,
  disabled,
}: JobDetailsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="job-name">Job Name *</Label>
          <Input
            id="job-name"
            value={jobName}
            onChange={(e) => onJobNameChange(e.target.value)}
            placeholder="Enter job name"
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-description">Description</Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Enter job description (optional)"
            disabled={disabled}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}
