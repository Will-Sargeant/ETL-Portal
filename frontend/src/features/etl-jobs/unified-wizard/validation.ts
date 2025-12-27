/**
 * Validation functions for wizard steps
 */

import type { WizardState, ValidationResult } from './types'

/**
 * Validate Step 1: Source Selection
 */
export function validateSourceSelection(state: WizardState): ValidationResult {
  const errors: string[] = []

  // Must have uploaded data
  if (!state.uploadedData) {
    errors.push('Please upload a CSV file')
  }

  // Must have source configuration
  if (!state.sourceConfig) {
    errors.push('Source configuration is missing')
  }

  // Uploaded data must have columns
  if (state.uploadedData && (!state.uploadedData.columns || state.uploadedData.columns.length === 0)) {
    errors.push('Uploaded file has no columns')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Step 2: Job Details
 */
export function validateJobDetails(state: WizardState): ValidationResult {
  const errors: string[] = []

  // Job name is required and must be non-empty
  if (!state.jobName || state.jobName.trim().length === 0) {
    errors.push('Job name is required')
  }

  // Batch size must be in valid range
  if (state.batchSize < 100) {
    errors.push('Batch size must be at least 100')
  }

  if (state.batchSize > 100000) {
    errors.push('Batch size must not exceed 100,000')
  }

  // Load strategy must be set
  if (!state.loadStrategy) {
    errors.push('Load strategy is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Step 3: Destination
 */
export function validateDestination(state: WizardState): ValidationResult {
  const errors: string[] = []

  // Destination configuration is required
  if (!state.destinationConfig) {
    errors.push('Destination configuration is required')
  } else {
    // Credential ID must be set
    if (!state.destinationConfig.credentialId) {
      errors.push('Database credential is required')
    }

    // Schema must be set
    if (!state.destinationConfig.schema || state.destinationConfig.schema.trim().length === 0) {
      errors.push('Database schema is required')
    }

    // Table must be set
    if (!state.destinationConfig.tableName || state.destinationConfig.tableName.trim().length === 0) {
      errors.push('Table name is required')
    }

    // Note: DDL generation is now handled automatically in the Review step,
    // so we don't validate newTableDDL here
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Step 4: Column Mapping
 */
export function validateColumnMapping(state: WizardState): ValidationResult {
  const errors: string[] = []

  // Must have at least one non-excluded column
  const activeColumns = state.columnMappings.filter((col) => !col.exclude)
  if (activeColumns.length === 0) {
    errors.push('At least one column must be mapped (not excluded)')
  }

  // Check for duplicate destination column names
  const destinationNames = state.columnMappings
    .filter((col) => !col.exclude && col.destinationColumn)
    .map((col) => col.destinationColumn)

  const duplicates = destinationNames.filter(
    (name, index) => destinationNames.indexOf(name) !== index
  )

  if (duplicates.length > 0) {
    errors.push(`Duplicate destination column names: ${[...new Set(duplicates)].join(', ')}`)
  }

  // If load strategy is upsert, must have upsert keys
  if (state.loadStrategy === 'upsert' && state.destinationConfig) {
    if (!state.destinationConfig.upsertKeys || state.destinationConfig.upsertKeys.length === 0) {
      errors.push('Upsert keys are required for upsert load strategy')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Step 5: Schedule (optional step)
 */
export function validateSchedule(state: WizardState): ValidationResult {
  const errors: string[] = []

  // If schedule is provided, validate cron expression
  if (state.schedule && state.schedule.cronExpression) {
    const cronExpression = state.schedule.cronExpression.trim()

    // Basic cron validation (5 or 6 fields separated by spaces)
    const parts = cronExpression.split(/\s+/)
    if (parts.length < 5 || parts.length > 6) {
      errors.push('Cron expression must have 5 or 6 fields')
    }

    // Check for empty cron expression
    if (cronExpression.length === 0) {
      errors.push('Cron expression cannot be empty')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Step 6: Review (no validation needed, just confirmation)
 */
export function validateReview(_state: WizardState): ValidationResult {
  return {
    valid: true,
    errors: [],
  }
}

/**
 * Get validator for a specific step
 */
export function getStepValidator(stepId: number): (state: WizardState) => ValidationResult {
  switch (stepId) {
    case 0:
      return validateSourceSelection
    case 1:
      return validateJobDetails
    case 2:
      return validateDestination
    case 3:
      return validateColumnMapping
    case 4:
      return validateSchedule
    case 5:
      return validateReview
    default:
      return () => ({ valid: false, errors: ['Invalid step'] })
  }
}

/**
 * Validate all steps up to and including the current step
 */
export function validateAllSteps(state: WizardState): Record<number, ValidationResult> {
  const results: Record<number, ValidationResult> = {}

  for (let i = 0; i <= state.currentStep; i++) {
    const validator = getStepValidator(i)
    results[i] = validator(state)
  }

  return results
}
