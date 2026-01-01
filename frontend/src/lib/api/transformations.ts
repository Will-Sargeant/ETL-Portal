import { apiClient } from '../api'

export interface Transformation {
  name: string
  description: string
  category: string
  params: string[]
}

export interface TransformationsByCategory {
  [category: string]: Transformation[]
}

export interface ExpressionTestResult {
  success: boolean
  error?: string
  result?: string
  result_type?: string
}

export const transformationsApi = {
  /**
   * Get all available transformations
   */
  getAll: async (): Promise<Transformation[]> => {
    const response = await apiClient.get<Transformation[]>('/transformations')
    return response.data
  },

  /**
   * Get transformations grouped by category
   */
  getByCategory: async (): Promise<TransformationsByCategory> => {
    const response = await apiClient.get<TransformationsByCategory>('/transformations/categories')
    return response.data
  },

  /**
   * Test and validate a Python expression
   */
  testExpression: async (expression: string, sampleColumns?: Record<string, any[]>): Promise<ExpressionTestResult> => {
    const response = await apiClient.post<ExpressionTestResult>('/transformations/test-expression', {
      expression,
      sample_columns: sampleColumns,
    })
    return response.data
  },
}
