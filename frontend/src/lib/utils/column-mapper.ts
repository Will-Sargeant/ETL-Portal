import type { ColumnInfo } from '@/types/source'
import type { TableColumn } from '@/types/destination'
import type { ColumnMappingConfig } from '@/types/source'
import { getTypeCompatibility, suggestTransformation } from './type-compatibility'

/**
 * Auto-map source columns to destination columns
 */
export function autoMapColumns(
  sourceColumns: ColumnInfo[],
  destinationColumns: TableColumn[]
): ColumnMappingConfig[] {
  const mappings: ColumnMappingConfig[] = []

  for (let i = 0; i < sourceColumns.length; i++) {
    const sourceCol = sourceColumns[i]
    const mapping = findBestMatch(sourceCol, destinationColumns, i)
    if (mapping) {
      mappings.push(mapping)
    }
  }

  return mappings
}

/**
 * Find the best matching destination column for a source column
 */
function findBestMatch(
  sourceCol: ColumnInfo,
  destinationColumns: TableColumn[],
  columnOrder: number
): ColumnMappingConfig | null {
  // Try exact name match (case-insensitive)
  let destCol = destinationColumns.find(
    (d) => d.name.toLowerCase() === sourceCol.name.toLowerCase()
  )

  // Try normalized match (remove underscores, lowercase)
  if (!destCol) {
    const normalizedSource = normalizeColumnName(sourceCol.name)
    destCol = destinationColumns.find(
      (d) => normalizeColumnName(d.name) === normalizedSource
    )
  }

  // Try fuzzy match
  if (!destCol) {
    const matches = destinationColumns
      .map((d) => ({
        column: d,
        score: calculateSimilarity(sourceCol.name, d.name),
      }))
      .filter((m) => m.score > 0.6) // Only consider matches above 60% similarity
      .sort((a, b) => b.score - a.score)

    if (matches.length > 0) {
      destCol = matches[0].column
    }
  }

  if (!destCol) {
    return null
  }

  // Map CSV types to SQL types
  const sourceType = mapCsvTypeToSql(sourceCol.data_type)
  const destinationType = destCol.type

  // Check compatibility and suggest transformation
  const compatibility = getTypeCompatibility(sourceType, destinationType)
  const transformation =
    compatibility === 'cast_needed'
      ? suggestTransformation(sourceType, destinationType)
      : undefined

  return {
    sourceColumn: sourceCol.name,
    destinationColumn: destCol.name,
    sourceType: sourceType,
    destinationType: destinationType,
    transformation: transformation || undefined,
    isNullable: destCol.nullable,
    defaultValue: destCol.default || undefined,
    exclude: false,
    isCalculated: false,
    columnOrder: columnOrder,
    isPrimaryKey: false,
  }
}

/**
 * Normalize column name for matching
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[_\s-]/g, '')
}

/**
 * Calculate string similarity (Dice coefficient)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1.0
  if (s1.length < 2 || s2.length < 2) return 0

  const bigrams1 = getBigrams(s1)
  const bigrams2 = getBigrams(s2)

  const intersection = bigrams1.filter((b) => bigrams2.includes(b))

  return (2.0 * intersection.length) / (bigrams1.length + bigrams2.length)
}

/**
 * Get bigrams from string
 */
function getBigrams(str: string): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2))
  }
  return bigrams
}

/**
 * Map CSV data types to SQL types
 */
function mapCsvTypeToSql(csvType: string): string {
  switch (csvType) {
    case 'text':
      return 'TEXT'
    case 'number':
      return 'NUMERIC'
    case 'date':
      return 'TIMESTAMP'
    case 'boolean':
      return 'BOOLEAN'
    default:
      return 'TEXT'
  }
}
