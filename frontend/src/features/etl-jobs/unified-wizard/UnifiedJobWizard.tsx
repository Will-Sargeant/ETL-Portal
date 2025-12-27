/**
 * Unified ETL Job Wizard - Main Component
 * Orchestrates the multi-step wizard for creating ETL jobs
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Save, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { etlJobsApi } from '@/lib/api/etl-jobs'

import { WizardStepIndicator } from './WizardStepIndicator'
import { SourceSelectionStep } from './SourceSelectionStep'
import { JobDetailsStep } from './JobDetailsStep'
import { DestinationStep } from './DestinationStep'
import { ColumnMappingStep } from './ColumnMappingStep'
import { ScheduleStep } from './ScheduleStep'
import { ReviewStep } from './ReviewStep'

import {
  INITIAL_WIZARD_STATE,
  WIZARD_STEPS,
  type WizardState,
} from './types'
import { getStepValidator } from './validation'
import { buildJobPayload } from './utils'

export function UnifiedJobWizard() {
  const navigate = useNavigate()
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Mutation for creating the job
  const createJobMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildJobPayload>) => etlJobsApi.create(payload),
    onSuccess: (job) => {
      toast.success(`Job "${job.name}" created successfully!`)
      navigate(`/jobs/${job.id}`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create job'
      toast.error(message)
    },
  })

  // Mutation for creating and executing the job
  const createAndExecuteMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildJobPayload>) => {
      const job = await etlJobsApi.create(payload)
      await etlJobsApi.execute(job.id)
      return job
    },
    onSuccess: (job) => {
      toast.success(`Job "${job.name}" created and execution started!`)
      navigate(`/jobs/${job.id}`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create and execute job'
      toast.error(message)
    },
  })

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
    // Clear validation errors when state changes
    setValidationErrors([])
  }

  const validateCurrentStep = (): boolean => {
    const validator = getStepValidator(state.currentStep)
    const result = validator(state)

    if (!result.valid) {
      setValidationErrors(result.errors)
      return false
    }

    setValidationErrors([])
    return true
  }

  const handleNext = () => {
    // Validate current step
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before proceeding')
      return
    }

    // Mark step as completed
    const newCompletedSteps = new Set(state.completedSteps)
    newCompletedSteps.add(state.currentStep)

    // Move to next step
    if (state.currentStep < WIZARD_STEPS.length - 1) {
      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        completedSteps: newCompletedSteps,
      }))
    }
  }

  const handleBack = () => {
    if (state.currentStep > 0) {
      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep - 1,
      }))
      setValidationErrors([])
    }
  }

  const handleSkip = () => {
    // Only allow skipping if the step can be skipped
    const currentStepConfig = WIZARD_STEPS[state.currentStep]
    if (currentStepConfig.canSkip) {
      const newCompletedSteps = new Set(state.completedSteps)
      newCompletedSteps.add(state.currentStep)

      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        completedSteps: newCompletedSteps,
      }))
      setValidationErrors([])
    }
  }

  const handleStepClick = (stepId: number) => {
    // Only allow navigation to completed steps or previous steps
    if (stepId < state.currentStep || state.completedSteps.has(stepId)) {
      setState((prev) => ({
        ...prev,
        currentStep: stepId,
      }))
      setValidationErrors([])
    }
  }

  const handleSaveDraft = async () => {
    // Validate all required steps
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before saving')
      return
    }

    const payload = buildJobPayload(state)
    createJobMutation.mutate(payload)
  }

  const handleSaveAndExecute = async () => {
    // Validate all required steps
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before creating the job')
      return
    }

    const payload = buildJobPayload(state)
    createAndExecuteMutation.mutate(payload)
  }

  // Render the current step
  const renderStep = () => {
    const commonProps = {
      state,
      onUpdate: updateState,
      onValidate: validateCurrentStep,
    }

    switch (state.currentStep) {
      case 0:
        return <SourceSelectionStep {...commonProps} />
      case 1:
        return <JobDetailsStep {...commonProps} />
      case 2:
        return <DestinationStep {...commonProps} />
      case 3:
        return <ColumnMappingStep {...commonProps} />
      case 4:
        return <ScheduleStep {...commonProps} />
      case 5:
        return <ReviewStep {...commonProps} />
      default:
        return null
    }
  }

  const currentStepConfig = WIZARD_STEPS[state.currentStep]
  const isFirstStep = state.currentStep === 0
  const isLastStep = state.currentStep === WIZARD_STEPS.length - 1
  const isLoading = createJobMutation.isPending || createAndExecuteMutation.isPending

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <WizardStepIndicator
        steps={WIZARD_STEPS}
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="font-medium mb-2">Please fix the following errors:</div>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx} className="text-sm">{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Step Content */}
      <div className="min-h-[500px]">
        {renderStep()}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div>
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Skip button for optional steps */}
          {currentStepConfig.canSkip && !isLastStep && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
            >
              Skip for now
            </Button>
          )}

          {/* Next/Action buttons */}
          {!isLastStep ? (
            <Button onClick={handleNext} disabled={isLoading} className="gap-2">
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isLoading}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </Button>
              <Button
                onClick={handleSaveAndExecute}
                disabled={isLoading}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoading ? 'Creating...' : 'Save & Execute Now'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
