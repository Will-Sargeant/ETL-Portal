import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import type { ETLJobCreate, ColumnMapping } from '@/types/etl-job'

import { BasicInfoStep } from './wizard/BasicInfoStep'
import { SourceConfigStep } from './wizard/SourceConfigStep'
import { DestinationConfigStep } from './wizard/DestinationConfigStep'
import { ColumnMappingStep } from './wizard/ColumnMappingStep'
import { ReviewStep } from './wizard/ReviewStep'

interface JobWizardProps {
  onSuccess?: () => void
}

type Step = 'basic' | 'source' | 'destination' | 'mapping' | 'review'

const STEPS: Step[] = ['basic', 'source', 'destination', 'mapping', 'review']

const STEP_TITLES: Record<Step, string> = {
  basic: 'Basic Information',
  source: 'Source Configuration',
  destination: 'Destination Configuration',
  mapping: 'Column Mapping',
  review: 'Review & Create',
}

export function JobWizard({ onSuccess }: JobWizardProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [formData, setFormData] = useState<Partial<ETLJobCreate>>({
    name: '',
    description: '',
    source_type: 'csv',
    source_config: {},
    destination_type: 'postgresql',
    destination_config: {},
    load_strategy: 'insert',
    batch_size: 10000,
    column_mappings: [],
  })

  const createMutation = useMutation({
    mutationFn: () => etlJobsApi.create(formData as ETLJobCreate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etl-jobs'] })
      toast.success('ETL job created successfully!')
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create ETL job'
      toast.error(message)
    },
  })

  const currentStepIndex = STEPS.indexOf(currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === STEPS.length - 1

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[currentStepIndex + 1])
    } else {
      createMutation.mutate()
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[currentStepIndex - 1])
    }
  }

  const updateFormData = (updates: Partial<ETLJobCreate>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(formData.name && formData.name.trim())
      case 'source':
        return !!(formData.source_config?.file_path)
      case 'destination':
        return !!(formData.destination_config?.credential_id && formData.destination_config?.table_name)
      case 'mapping':
        return (formData.column_mappings?.length ?? 0) > 0
      case 'review':
        return true
      default:
        return false
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create ETL Job</CardTitle>
        <CardDescription>
          Step {currentStepIndex + 1} of {STEPS.length}: {STEP_TITLES[currentStep]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index < currentStepIndex
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index === currentStepIndex
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 'basic' && (
            <BasicInfoStep data={formData} onChange={updateFormData} />
          )}
          {currentStep === 'source' && (
            <SourceConfigStep data={formData} onChange={updateFormData} />
          )}
          {currentStep === 'destination' && (
            <DestinationConfigStep data={formData} onChange={updateFormData} />
          )}
          {currentStep === 'mapping' && (
            <ColumnMappingStep data={formData} onChange={updateFormData} />
          )}
          {currentStep === 'review' && <ReviewStep data={formData as ETLJobCreate} />}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={isFirstStep}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || createMutation.isPending}>
            {isLastStep ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Job
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
