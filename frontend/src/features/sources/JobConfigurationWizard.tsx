import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { UploadResponse, JobConfiguration } from '@/types/source'
import { DestinationMappingStep } from './DestinationMappingStep'
import { ScheduleConfigStep } from './ScheduleConfigStep'

interface JobConfigurationWizardProps {
  uploadedData: UploadResponse
  currentStep: 2 | 3
  jobConfig: JobConfiguration
  onJobConfigChange: (config: Partial<JobConfiguration>) => void
  onStepChange: (step: 2 | 3) => void
  onComplete: (runImmediately: boolean) => void
  onCancel: () => void
}

export function JobConfigurationWizard({
  uploadedData,
  currentStep,
  jobConfig,
  onJobConfigChange,
  onStepChange,
  onComplete,
  onCancel,
}: JobConfigurationWizardProps) {
  const validateStep2 = (): boolean => {
    if (!jobConfig.destination) {
      toast.error('Please select a destination')
      return false
    }
    if (!jobConfig.destination.tableName) {
      toast.error('Please select or create a table')
      return false
    }
    if (jobConfig.columnMappings.length === 0) {
      toast.error('At least one column mapping is required')
      return false
    }
    if (
      jobConfig.destination.loadStrategy === 'upsert' &&
      (!jobConfig.destination.upsertKeys || jobConfig.destination.upsertKeys.length === 0)
    ) {
      toast.error('Upsert keys are required for upsert strategy')
      return false
    }
    return true
  }

  const handleNext = () => {
    if (currentStep === 2 && validateStep2()) {
      onStepChange(3)
    }
  }

  const handleBack = () => {
    if (currentStep === 3) {
      onStepChange(2)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentStep === 2 && (
          <DestinationMappingStep
            uploadedData={uploadedData}
            destination={jobConfig.destination}
            tableSchema={jobConfig.tableSchema}
            columnMappings={jobConfig.columnMappings}
            onDestinationChange={(destination) => onJobConfigChange({ destination })}
            onTableSchemaFetched={(tableSchema) => onJobConfigChange({ tableSchema })}
            onColumnMappingsChange={(columnMappings) =>
              onJobConfigChange({ columnMappings })
            }
          />
        )}

        {currentStep === 3 && (
          <ScheduleConfigStep
            schedule={jobConfig.schedule}
            batchSize={jobConfig.batchSize}
            onScheduleChange={(schedule) => onJobConfigChange({ schedule })}
            onBatchSizeChange={(batchSize) => onJobConfigChange({ batchSize })}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t p-4 flex justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 2}>
          Back
        </Button>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          {currentStep === 2 && (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          )}

          {currentStep === 3 && (
            <>
              <Button type="button" variant="outline" onClick={() => onComplete(false)}>
                Save Draft
              </Button>
              <Button type="button" onClick={() => onComplete(true)}>
                Save & Run Now
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
