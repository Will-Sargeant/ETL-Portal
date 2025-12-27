/**
 * Utility functions for the Unified ETL Job Wizard
 */

import type { WizardState, UploadResponse } from './types'
import type { ETLJobCreate, ColumnMapping, ScheduleCreate } from '@/types/etl-job'
import type { ColumnMappingConfig } from '@/types/source'

/**
 * Convert wizard state to API format for job creation
 */
export function buildJobPayload(state: WizardState): ETLJobCreate {
  // Convert column mappings from wizard format (camelCase) to API format (snake_case)
  const columnMappings: ColumnMapping[] = state.columnMappings.map((mapping) => ({
    source_column: mapping.sourceColumn || '',
    destination_column: mapping.destinationColumn || '',
    source_type: mapping.sourceType || 'TEXT',
    destination_type: mapping.destinationType || 'TEXT',
    transformations: mapping.transformations || [],
    is_nullable: mapping.isNullable ?? true,
    default_value: mapping.defaultValue,
    exclude: mapping.exclude ?? false,
    column_order: mapping.columnOrder ?? 0,
    is_primary_key: mapping.isPrimaryKey ?? false,
  }))

  // Convert schedule if provided
  let schedule: ScheduleCreate | undefined
  if (state.schedule) {
    schedule = {
      cron_expression: state.schedule.cronExpression,
      enabled: state.schedule.enabled,
    }
  }

  // Convert destination config to API format
  const destinationConfig: Record<string, any> = {
    credential_id: state.destinationConfig?.credentialId,
    schema: state.destinationConfig?.schema,
    table: state.destinationConfig?.tableName,
  }

  // Build the payload
  const payload: ETLJobCreate = {
    name: state.jobName,
    description: state.jobDescription || undefined,
    source_type: state.sourceType,
    source_config: state.sourceConfig || {},
    destination_type: state.destinationType,
    destination_config: destinationConfig,
    load_strategy: state.loadStrategy,
    upsert_keys: state.destinationConfig?.upsertKeys,
    transformation_rules: {},
    batch_size: state.batchSize,
    column_mappings: columnMappings,
    schedule,
    create_new_table: state.destinationConfig?.createNewTable,
    new_table_ddl: state.destinationConfig?.newTableDDL,
  }

  return payload
}

/**
 * Auto-populate wizard state from CSV upload response
 */
export function autoPopulateFromCSV(uploadResponse: UploadResponse): Partial<WizardState> {
  // Extract filename without extension for job name
  const baseFilename = uploadResponse.filename.replace(/\.(csv|CSV)$/, '')

  // Create source configuration
  const sourceConfig = {
    file_id: uploadResponse.file_id,
    filename: uploadResponse.filename,
  }

  // Auto-generate column mappings from uploaded columns
  const columnMappings: ColumnMappingConfig[] = uploadResponse.columns.map((col, index) => ({
    sourceColumn: col.name,
    destinationColumn: col.name, // Auto-map to same name initially
    sourceType: col.data_type.toUpperCase(),
    destinationType: col.data_type.toUpperCase(),
    transformations: [],
    isNullable: col.is_nullable,
    exclude: false,
    columnOrder: index,
    isPrimaryKey: false,
  }))

  return {
    uploadedData: uploadResponse,
    sourceConfig,
    jobName: baseFilename,
    columnMappings,
  }
}

/**
 * Smart column mapping: Match CSV columns to existing table columns
 * Uses exact matching
 *
 * Returns ALL table columns with clear indicators:
 * - CSV columns mapped to table columns
 * - CSV columns with no table match (excluded)
 * - Table columns with no CSV source (needs user attention)
 *
 * Special handling for truncate_insert strategy:
 * - Auto-excludes auto-generated columns (created_at, updated_at) since they'll be recreated
 * - Auto-excludes nullable columns and columns with defaults (they're optional)
 */
export function remapColumnsToTable(
  csvColumns: ColumnMappingConfig[],
  tableColumns: Array<{ name: string; type: string; nullable: boolean; default?: string }>,
  loadStrategy?: 'insert' | 'upsert' | 'truncate_insert'
): ColumnMappingConfig[] {
  const tableColumnNames = tableColumns.map(col => col.name.toLowerCase())
  const tableColumnMap = new Map(
    tableColumns.map(col => [col.name.toLowerCase(), col])
  )

  // Track which table columns have been mapped
  const mappedTableColumns = new Set<string>()

  // Separate CSV columns into those with sourceColumn (from CSV) and those without (already table-only columns)
  const csvSourceColumns = csvColumns.filter(col => col.sourceColumn)
  const existingTableOnlyColumns = csvColumns.filter(col => !col.sourceColumn)

  // Track existing table-only columns to avoid duplicates
  const existingTableOnlyColumnNames = new Set(
    existingTableOnlyColumns.map(col => col.destinationColumn?.toLowerCase()).filter(Boolean)
  )

  // First pass: Map CSV columns to table columns
  const mappedCsvColumns = csvSourceColumns.map((csvCol, idx) => {
    const csvColNameLower = csvCol.sourceColumn.toLowerCase()

    // Only use exact match (case-insensitive) - no fuzzy matching
    if (tableColumnNames.includes(csvColNameLower)) {
      const tableCol = tableColumnMap.get(csvColNameLower)!
      mappedTableColumns.add(tableCol.name.toLowerCase())
      return {
        ...csvCol,
        destinationColumn: tableCol.name, // Use actual table column name (preserves case)
        destinationType: tableCol.type.toUpperCase(),
        isNullable: tableCol.nullable,
        exclude: false, // Clear exclude flag for matched columns
        columnOrder: idx,
      }
    }

    // No exact match - leave unmapped (destinationColumn empty) for user to select
    return {
      ...csvCol,
      destinationColumn: '', // Leave blank for user to map manually
      destinationType: '', // Clear destination type as well
      exclude: true, // Mark as excluded until user maps it
      columnOrder: idx,
    }
  })

  // Auto-generated columns that will be recreated by DDL generator
  const autoGeneratedColumns = new Set(['created_at', 'updated_at', 'inserted_date', 'modified_date'])
  const isTruncateInsert = loadStrategy === 'truncate_insert'

  // Second pass: Add unmapped table columns (columns that exist in table but not in CSV)
  // Skip if already added as table-only columns OR if already mapped from a CSV column
  const unmappedTableColumns: ColumnMappingConfig[] = tableColumns
    .filter(tableCol => {
      const lowerName = tableCol.name.toLowerCase()

      // Skip if already mapped via exact match
      if (mappedTableColumns.has(lowerName)) return false

      // Skip if already exists as table-only column from previous selection
      if (existingTableOnlyColumnNames.has(lowerName)) return false

      // Skip if ANY CSV column (including from input csvColumns with manual mappings) is mapped to this table column
      // Check BOTH the newly mapped columns AND the original input (which may have manual mappings)
      const matchingCsvCol = csvColumns.find(csvCol =>
        csvCol.sourceColumn && // Must have a source column (is a CSV column)
        csvCol.destinationColumn?.toLowerCase() === lowerName &&
        !csvCol.exclude
      )
      if (matchingCsvCol) return false

      // For truncate_insert, skip auto-generated columns since they'll be recreated
      if (isTruncateInsert && autoGeneratedColumns.has(lowerName)) {
        return false
      }

      return true
    })
    .map((tableCol, idx) => {
      // Check if this column has a default value or is nullable
      const hasDefault = !!tableCol.default
      const lowerName = tableCol.name.toLowerCase()
      const isAutoPopulated = autoGeneratedColumns.has(lowerName)

      // For truncate_insert: Exclude columns without CSV source by default (except required ones)
      // - Columns that are nullable or have defaults are excluded (they're optional)
      // - Columns that are NOT nullable and have no default REQUIRE user action
      // For other strategies: Keep them included by default
      const shouldExcludeByDefault = isTruncateInsert && (tableCol.nullable || hasDefault)

      return {
        sourceColumn: '', // No CSV source
        destinationColumn: tableCol.name,
        sourceType: 'TEXT',
        destinationType: tableCol.type.toUpperCase(),
        transformations: [],
        isNullable: tableCol.nullable,
        defaultValue: tableCol.default,
        exclude: shouldExcludeByDefault, // For truncate_insert, exclude columns without CSV source by default
        columnOrder: mappedCsvColumns.length + existingTableOnlyColumns.length + idx,
        isPrimaryKey: false,
      }
    })

  // Combine all lists: CSV-mapped columns first, existing table-only columns, then newly discovered unmapped table columns
  return [...mappedCsvColumns, ...existingTableOnlyColumns, ...unmappedTableColumns]
}

/**
 * Find the best matching column name using fuzzy matching
 * Returns the matched table column name (lowercase) or null
 */
function findBestColumnMatch(csvColumn: string, tableColumns: string[]): string | null {
  const csvLower = csvColumn.toLowerCase()

  // Remove common prefixes/suffixes and special characters for matching
  const normalize = (str: string) =>
    str.replace(/[_\s-]/g, '').replace(/^(user|customer|client)/, '').replace(/(id|name|date|time)$/, '')

  const csvNormalized = normalize(csvLower)

  for (const tableCol of tableColumns) {
    const tableNormalized = normalize(tableCol)

    // Check if normalized versions match
    if (csvNormalized === tableNormalized) {
      return tableCol
    }

    // Check if one contains the other (e.g., "name" matches "user_name")
    if (tableCol.includes(csvLower) || csvLower.includes(tableCol)) {
      // Prefer shorter matches to avoid false positives
      if (Math.abs(tableCol.length - csvLower.length) <= 5) {
        return tableCol
      }
    }
  }

  return null
}

/**
 * Get available column names for expression editor
 */
export function getAvailableColumns(state: WizardState): string[] {
  return state.columnMappings
    .filter((col) => !col.exclude && col.destinationColumn)
    .map((col) => col.destinationColumn!)
}

/**
 * Get next column order number
 */
export function getNextColumnOrder(columnMappings: ColumnMappingConfig[]): number {
  if (columnMappings.length === 0) return 0
  return Math.max(...columnMappings.map((col) => col.columnOrder ?? 0)) + 1
}

/**
 * Generate DDL for creating a new table based on column mappings
 */
export function generateTableDDL(
  schema: string,
  tableName: string,
  columnMappings: ColumnMappingConfig[]
): string {
  const activeColumns = columnMappings.filter((col) => !col.exclude)

  if (activeColumns.length === 0) {
    return '-- No columns to create'
  }

  const columnDefinitions = activeColumns.map((col) => {
    const parts: string[] = []

    // Column name
    parts.push(`  "${col.destinationColumn}"`)

    // Data type
    parts.push(col.destinationType || 'TEXT')

    // Primary key
    if (col.isPrimaryKey) {
      parts.push('PRIMARY KEY')
    }

    // Nullable
    if (!col.isNullable) {
      parts.push('NOT NULL')
    }

    // Default value
    if (col.defaultValue) {
      parts.push(`DEFAULT ${col.defaultValue}`)
    }

    return parts.join(' ')
  })

  const ddl = `CREATE TABLE "${schema}"."${tableName}" (
${columnDefinitions.join(',\n')}
);`

  return ddl
}

/**
 * Validate upsert keys against column mappings
 */
export function validateUpsertKeys(
  upsertKeys: string[],
  columnMappings: ColumnMappingConfig[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const activeColumnNames = columnMappings
    .filter((col) => !col.exclude)
    .map((col) => col.destinationColumn)

  for (const key of upsertKeys) {
    if (!activeColumnNames.includes(key)) {
      errors.push(`Upsert key "${key}" is not in the active column mappings`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Auto-map columns by name between source and destination
 * Useful when selecting an existing table with known columns
 */
export function autoMapColumnsByName(
  sourceColumns: string[],
  destinationColumns: string[]
): Map<string, string> {
  const mappings = new Map<string, string>()

  for (const sourceCol of sourceColumns) {
    // Try exact match first
    if (destinationColumns.includes(sourceCol)) {
      mappings.set(sourceCol, sourceCol)
      continue
    }

    // Try case-insensitive match
    const lowerSourceCol = sourceCol.toLowerCase()
    const matchingDestCol = destinationColumns.find(
      (destCol) => destCol.toLowerCase() === lowerSourceCol
    )

    if (matchingDestCol) {
      mappings.set(sourceCol, matchingDestCol)
    }
  }

  return mappings
}

/**
 * Calculate summary statistics for wizard review step
 */
export function calculateWizardSummary(state: WizardState) {
  const activeColumns = state.columnMappings.filter((col) => !col.exclude)
  const transformedColumns = activeColumns.filter(
    (col) => col.transformations && col.transformations.length > 0
  )

  return {
    totalColumns: state.columnMappings.length,
    activeColumns: activeColumns.length,
    excludedColumns: state.columnMappings.length - activeColumns.length,
    transformedColumns: transformedColumns.length,
    totalRows: state.uploadedData?.row_count ?? 0,
    hasSchedule: !!state.schedule,
    scheduleCron: state.schedule?.cronExpression,
  }
}

/**
 * Check if wizard can proceed to next step
 */
export function canProceedToNextStep(
  currentStep: number,
  completedSteps: Set<number>
): boolean {
  // Can always proceed if current step is completed
  if (completedSteps.has(currentStep)) {
    return true
  }

  // Can proceed if all previous steps are completed
  for (let i = 0; i < currentStep; i++) {
    if (!completedSteps.has(i)) {
      return false
    }
  }

  return true
}

/**
 * Mark a step as completed and update the set
 */
export function markStepCompleted(
  completedSteps: Set<number>,
  stepId: number
): Set<number> {
  const newSet = new Set(completedSteps)
  newSet.add(stepId)
  return newSet
}
