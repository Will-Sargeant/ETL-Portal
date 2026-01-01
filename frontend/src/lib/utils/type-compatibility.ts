/**
 * Type compatibility utilities for column mapping
 */

type CompatibilityLevel = 'compatible' | 'cast_needed' | 'incompatible'

/**
 * Check if source type is compatible with destination type
 */
export function getTypeCompatibility(
  sourceType: string,
  destinationType: string
): CompatibilityLevel {
  const source = sourceType.toLowerCase()
  const dest = destinationType.toLowerCase()

  // Direct compatible types
  if (isTextType(source) && isTextType(dest)) return 'compatible'
  if (isNumberType(source) && isNumberType(dest)) return 'compatible'
  if (isDateType(source) && isDateType(dest)) return 'compatible'
  if (isBooleanType(source) && isBooleanType(dest)) return 'compatible'

  // Cast-able types
  if (isNumberType(source) && isTextType(dest)) return 'cast_needed'
  if (isTextType(source) && isNumberType(dest)) return 'cast_needed'
  if (isDateType(source) && isTextType(dest)) return 'cast_needed'
  if (isBooleanType(source) && isTextType(dest)) return 'cast_needed'
  if (isTextType(source) && isBooleanType(dest)) return 'cast_needed'

  // Incompatible types
  if (isTextType(source) && isDateType(dest)) return 'incompatible'
  if (isNumberType(source) && isDateType(dest)) return 'incompatible'

  return 'compatible' // Default to compatible for unknown types
}

/**
 * Suggest a transformation for type casting
 */
export function suggestTransformation(
  sourceType: string,
  destinationType: string
): string | null {
  const source = sourceType.toLowerCase()
  const dest = destinationType.toLowerCase()

  // Number to text
  if (isNumberType(source) && isTextType(dest)) {
    return '::text'
  }

  // Text to number
  if (isTextType(source) && isNumberType(dest)) {
    if (dest.includes('int')) return '::integer'
    if (dest.includes('decimal') || dest.includes('numeric')) return '::numeric'
    return '::integer'
  }

  // Date to text
  if (isDateType(source) && isTextType(dest)) {
    return '::text'
  }

  // Boolean to text
  if (isBooleanType(source) && isTextType(dest)) {
    return '::text'
  }

  // Text to boolean
  if (isTextType(source) && isBooleanType(dest)) {
    return '::boolean'
  }

  return null
}

/**
 * Get color class for compatibility badge
 */
export function getCompatibilityColor(level: CompatibilityLevel): string {
  switch (level) {
    case 'compatible':
      return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
    case 'cast_needed':
      return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30'
    case 'incompatible':
      return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
  }
}

/**
 * Get icon for compatibility level
 */
export function getCompatibilityIcon(level: CompatibilityLevel): string {
  switch (level) {
    case 'compatible':
      return '✓'
    case 'cast_needed':
      return '⚠'
    case 'incompatible':
      return '✗'
  }
}

// Helper functions
function isTextType(type: string): boolean {
  return /text|varchar|char|string/.test(type)
}

function isNumberType(type: string): boolean {
  return /int|integer|bigint|smallint|decimal|numeric|float|double|real/.test(type)
}

function isDateType(type: string): boolean {
  return /date|timestamp|time/.test(type)
}

function isBooleanType(type: string): boolean {
  return /bool/.test(type)
}
