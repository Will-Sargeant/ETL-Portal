import type { ETLJob } from '@/types/etl-job'
import { CSVPreviewTab } from './CSVPreviewTab'
import { GoogleSheetsPreviewTab } from './GoogleSheetsPreviewTab'

interface SourcePreviewTabProps {
  job: ETLJob
}

/**
 * Dynamic source preview component that routes to the appropriate preview
 * based on the job's source type (CSV or Google Sheets)
 */
export function SourcePreviewTab({ job }: SourcePreviewTabProps) {
  if (job.source_type === 'google_sheets') {
    return <GoogleSheetsPreviewTab job={job} />
  }

  // Default to CSV preview for 'csv' and legacy source types
  return <CSVPreviewTab job={job} />
}
