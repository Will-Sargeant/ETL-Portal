/**
 * Transformations constants
 * Mirrors the transformations available in the backend transformation service
 */

export interface Transformation {
  name: string
  description: string
  category: string
  params: string[]
}

export interface TransformationsByCategory {
  [category: string]: Transformation[]
}

export const TRANSFORMATIONS: Transformation[] = [
  // String Transformations
  { name: 'UPPER', description: 'Convert text to UPPERCASE', category: 'string', params: [] },
  { name: 'LOWER', description: 'Convert text to lowercase', category: 'string', params: [] },
  { name: 'TRIM', description: 'Remove leading and trailing whitespace', category: 'string', params: [] },
  { name: 'LTRIM', description: 'Remove leading whitespace', category: 'string', params: [] },
  { name: 'RTRIM', description: 'Remove trailing whitespace', category: 'string', params: [] },
  { name: 'REMOVE_SPACES', description: 'Remove all spaces from text', category: 'string', params: [] },
  { name: 'CAPITALIZE', description: 'Capitalize first letter of each value', category: 'string', params: [] },
  { name: 'TITLE', description: 'Convert To Title Case', category: 'string', params: [] },
  { name: 'REVERSE', description: 'Reverse text', category: 'string', params: [] },
  { name: 'LENGTH', description: 'Get length of text', category: 'string', params: [] },

  // Date/Time Transformations
  { name: 'EXTRACT_YEAR', description: 'Extract year from date (e.g., 2024)', category: 'date', params: [] },
  { name: 'EXTRACT_MONTH', description: 'Extract month number (1-12)', category: 'date', params: [] },
  { name: 'EXTRACT_DAY', description: 'Extract day of month (1-31)', category: 'date', params: [] },
  { name: 'TODAY', description: 'Replace with current date', category: 'date', params: [] },
  { name: 'NOW', description: 'Replace with current date and time', category: 'date', params: [] },

  // Numeric Transformations
  { name: 'ABS', description: 'Get absolute value', category: 'numeric', params: [] },
  { name: 'FLOOR', description: 'Round down to nearest integer', category: 'numeric', params: [] },
  { name: 'CEILING', description: 'Round up to nearest integer', category: 'numeric', params: [] },

  // Null Handling
  { name: 'FILL_NULL', description: 'Replace null values with empty string', category: 'null_handling', params: [] },
  { name: 'FILL_ZERO', description: 'Replace null values with zero', category: 'null_handling', params: [] },
]

/**
 * Get transformations grouped by category
 */
export function getTransformationsByCategory(): TransformationsByCategory {
  const grouped: TransformationsByCategory = {}

  TRANSFORMATIONS.forEach(transform => {
    if (!grouped[transform.category]) {
      grouped[transform.category] = []
    }
    grouped[transform.category].push(transform)
  })

  return grouped
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  const displayNames: Record<string, string> = {
    string: 'String',
    date: 'Date/Time',
    numeric: 'Numeric',
    null_handling: 'Null Handling',
  }
  return displayNames[category] || category
}
