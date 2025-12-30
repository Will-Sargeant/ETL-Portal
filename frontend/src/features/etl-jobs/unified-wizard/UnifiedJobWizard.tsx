/**
 * Unified ETL Job Wizard - Main Component
 * Orchestrates the multi-step wizard for creating or editing ETL jobs
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import type { ETLJob } from '@/types/etl-job'

interface UnifiedJobWizardProps {
  existingJob?: ETLJob
  mode?: 'create' | 'edit'
}

export function UnifiedJobWizard({ existingJob, mode = 'create' }: UnifiedJobWizardProps = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const isEditMode = mode === 'edit' && !!existingJob

  // Pre-populate state from existing job in edit mode
  useEffect(() => {
    if (isEditMode && existingJob) {
      // Convert existing job to wizard state
      const editState: Partial<WizardState> = {
        currentStep: 1, // Start at Job Details (skip source selection)
        jobName: existingJob.name,
        jobDescription: existingJob.description || '',
        sourceType: existingJob.source_type,
        sourceConfig: existingJob.source_config,
        googleSheetsConfig: existingJob.source_type === 'google_sheets' ? existingJob.source_config : undefined,
        destinationType: existingJob.destination_type,
        destinationConfig: {
          credentialId: existingJob.destination_config?.credential_id,
          schema: existingJob.destination_config?.schema || '',
          tableName: existingJob.destination_config?.table || existingJob.destination_config?.table_name || '',
          loadStrategy: existingJob.load_strategy,
          createNewTable: existingJob.create_new_table || false,
          newTableDDL: existingJob.new_table_ddl,
          upsertKeys: existingJob.upsert_keys || [],
        },
        loadStrategy: existingJob.load_strategy,
        batchSize: existingJob.batch_size || 10000,
        columnMappings: (existingJob.column_mappings || []).map((cm) => ({
          sourceColumn: cm.source_column || '',
          destinationColumn: cm.destination_column || '',
          sourceType: cm.source_type || 'TEXT',
          destinationType: cm.destination_type || 'TEXT',
          transformations: cm.transformations || [],
          isNullable: cm.is_nullable ?? true,
          defaultValue: cm.default_value,
          exclude: cm.exclude ?? false,
          columnOrder: cm.column_order ?? 0,
          isPrimaryKey: cm.is_primary_key ?? false,
        })),
        schedule: existingJob.schedule ? {
          cronExpression: existingJob.schedule.cron_expression,
          enabled: existingJob.schedule.enabled,
        } : null,
      }

      setState((prev) => ({ ...prev, ...editState }))
    }
  }, [isEditMode, existingJob])

  // Handle step query parameter for direct navigation
  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10)
      // Validate step is within valid range (0-5)
      if (stepNum >= 0 && stepNum <= 5) {
        // In edit mode, don't allow navigation to step 0 (source selection)
        const targetStep = isEditMode && stepNum === 0 ? 1 : stepNum
        setState((prev) => ({ ...prev, currentStep: targetStep }))
      }
    }
  }, [searchParams, isEditMode])

  // Mutation for updating the job (edit mode)
  const updateJobMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildJobPayload>) => {
      if (!existingJob) throw new Error('No existing job to update')
      return etlJobsApi.update(existingJob.id, payload)
    },
    onSuccess: (job) => {
      toast.success(`Job "${job.name}" updated successfully!`)
      navigate(`/jobs/${job.id}`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update job'
      toast.error(message)
    },
  })

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
    // In edit mode, don't allow going back to step 0 (source selection)
    const minStep = isEditMode ? 1 : 0
    if (state.currentStep > minStep) {
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

    // Use update mutation in edit mode, create mutation in create mode
    if (isEditMode) {
      updateJobMutation.mutate(payload)
    } else {
      createJobMutation.mutate(payload)
    }
  }

  const handleSaveAndExecute = async () => {
    // Validate all required steps
    if (!validateCurrentStep()) {
      toast.error(`Please fix the errors before ${isEditMode ? 'saving' : 'creating'} the job`)
      return
    }

    const payload = buildJobPayload(state)

    // In edit mode, just save (can't execute during edit)
    // In create mode, create and execute
    if (isEditMode) {
      updateJobMutation.mutate(payload)
    } else {
      createAndExecuteMutation.mutate(payload)
    }
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
  const isFirstStep = isEditMode ? state.currentStep === 1 : state.currentStep === 0
  const isLastStep = state.currentStep === WIZARD_STEPS.length - 1
  const isLoading = createJobMutation.isPending || createAndExecuteMutation.isPending || updateJobMutation.isPending

  // Filter out source selection step in edit mode (can't change source)
  const visibleSteps = isEditMode ? WIZARD_STEPS.filter(step => step.id !== 0) : WIZARD_STEPS

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <WizardStepIndicator
        steps={visibleSteps}
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
              {isEditMode ? (
                // Edit mode: Only show Save Changes button
                <Button
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              ) : (
                // Create mode: Show both Save as Draft and Save & Execute
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
