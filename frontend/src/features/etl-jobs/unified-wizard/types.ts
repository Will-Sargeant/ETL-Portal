/**
 * Type definitions for the Unified ETL Job Wizard
 */

import type { ColumnMappingConfig, UploadResponse } from '@/types/source'
import type { ScheduleConfig } from '@/types/schedule'
import type { DestinationConfig, TableSchema } from '@/types/destination'

// Re-export types for use in other wizard files
export type { UploadResponse }

/**
 * Source types supported by the wizard
 */
export type SourceType = 'csv' | 'google_sheets'

/**
 * Load strategies for ETL jobs
 */
export type LoadStrategy = 'insert' | 'upsert' | 'truncate_insert'

/**
 * Destination types
 */
export type DestinationType = 'postgresql' | 'redshift'

/**
 * Source configuration for CSV
 */
export interface SourceConfig {
  file_id: string
  filename: string
}

/**
 * Google Sheets configuration
 */
export interface GoogleSheetsConfig {
  encrypted_credentials: string
  spreadsheet_id: string
  sheet_name: string
  // Range configuration (optional)
  start_row?: number           // First row to read (1-indexed, defaults to 1)
  header_row?: number          // Row containing headers (1-indexed, defaults to start_row)
  end_row?: number             // Last row to read (optional, defaults to all rows)
  start_column?: string        // First column (A, B, C, etc., defaults to A)
  end_column?: string          // Last column (optional, defaults to all columns)
}

/**
 * Detected column info from source
 */
export interface DetectedColumn {
  name: string
  type: string
  order: number
}

/**
 * Complete wizard state
 */
export interface WizardState {
  // Step 1: Source Selection
  sourceType: SourceType
  uploadedData: UploadResponse | null
  sourceConfig: SourceConfig | null
  googleSheetsConfig: GoogleSheetsConfig | null
  detectedColumns: DetectedColumn[]

  // Step 2: Job Details
  jobName: string
  jobDescription: string
  batchSize: number
  loadStrategy: LoadStrategy

  // Step 3: Destination
  destinationType: DestinationType
  destinationConfig: DestinationConfig | null
  tableSchema: TableSchema | null

  // Step 4: Column Mappings
  columnMappings: ColumnMappingConfig[]

  // Step 5: Schedule (optional)
  schedule: ScheduleConfig | null

  // Wizard metadata
  currentStep: number
  completedSteps: Set<number>
}

/**
 * Validation result for wizard steps
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Step validation function type
 */
export type StepValidator = (state: WizardState) => ValidationResult

/**
 * Wizard step metadata
 */
export interface WizardStep {
  id: number
  title: string
  description: string
  canSkip: boolean
  validator: StepValidator
}

/**
 * Initial state for the wizard
 */
export const INITIAL_WIZARD_STATE: WizardState = {
  // Step 1
  sourceType: 'csv',
  uploadedData: null,
  sourceConfig: null,
  googleSheetsConfig: null,
  detectedColumns: [],

  // Step 2
  jobName: '',
  jobDescription: '',
  batchSize: 10000,
  loadStrategy: 'insert',

  // Step 3
  destinationType: 'postgresql',
  destinationConfig: null,
  tableSchema: null,

  // Step 4
  columnMappings: [],

  // Step 5
  schedule: null,

  // Wizard meta
  currentStep: 0,
  completedSteps: new Set(),
}

/**
 * Wizard steps configuration
 */
export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 0,
    title: 'Source Selection',
    description: 'Upload CSV or connect to Google Sheets',
    canSkip: false,
    validator: () => ({ valid: true, errors: [] }), // Placeholder, implemented in validation.ts
  },
  {
    id: 1,
    title: 'Job Details',
    description: 'Configure job name, batch size, and load strategy',
    canSkip: false,
    validator: () => ({ valid: true, errors: [] }),
  },
  {
    id: 2,
    title: 'Destination',
    description: 'Select database and table configuration',
    canSkip: false,
    validator: () => ({ valid: true, errors: [] }),
  },
  {
    id: 3,
    title: 'Column Mapping',
    description: 'Map and transform columns',
    canSkip: false,
    validator: () => ({ valid: true, errors: [] }),
  },
  {
    id: 4,
    title: 'Schedule',
    description: 'Set up job schedule (optional)',
    canSkip: true,
    validator: () => ({ valid: true, errors: [] }),
  },
  {
    id: 5,
    title: 'Review',
    description: 'Review and create job',
    canSkip: false,
    validator: () => ({ valid: true, errors: [] }),
  },
]
