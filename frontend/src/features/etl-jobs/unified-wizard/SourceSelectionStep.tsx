/**
 * Step 1: Source Selection
 * Upload CSV or connect to Google Sheets
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon, CheckCircle2 } from 'lucide-react'

import { CSVUpload } from '@/features/sources/CSVUpload'
import { DataPreview } from '@/features/sources/DataPreview'
import { GoogleSheetsOAuth } from '@/features/sources/GoogleSheetsOAuth'
import { GoogleSheetSelector } from '@/features/sources/GoogleSheetSelector'
import type { UploadResponse } from '@/types/source'
import type { WizardState } from './types'
import { autoPopulateFromCSV, autoPopulateFromGoogleSheets } from './utils'

interface SourceSelectionStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
}

export function SourceSelectionStep({
  state,
  onUpdate,
}: SourceSelectionStepProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'google_sheets'>('csv')
  const [googleCredentials, setGoogleCredentials] = useState<string>('')

  const handleUploadSuccess = (data: UploadResponse) => {
    const updates = autoPopulateFromCSV(data)
    onUpdate(updates)
  }

  const handleOAuthSuccess = (credentials: string) => {
    setGoogleCredentials(credentials)
  }

  const handleSheetSelect = (
    spreadsheetId: string,
    sheetName: string,
    columns: string[],
    rangeConfig?: {
      start_row?: number
      header_row?: number
      end_row?: number
      start_column?: string
      end_column?: string
    }
  ) => {
    // Auto-populate wizard state from Google Sheets data
    const updates = autoPopulateFromGoogleSheets(
      spreadsheetId,
      sheetName,
      columns,
      googleCredentials,
      rangeConfig
    )
    onUpdate(updates)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Select Data Source</h2>
        <p className="text-muted-foreground mt-1">
          Upload a CSV file or connect to Google Sheets to begin
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'csv' | 'google_sheets')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          <TabsTrigger value="google_sheets">
            Google Sheets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6 mt-6">
          {!state.uploadedData ? (
            <CSVUpload onUploadSuccess={handleUploadSuccess} />
          ) : (
            <>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  File uploaded successfully! Review the data preview below, then proceed to the next step.
                </AlertDescription>
              </Alert>

              <DataPreview
                data={state.uploadedData.preview}
                filename={state.uploadedData.filename}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="google_sheets" className="space-y-6 mt-6">
          {!googleCredentials ? (
            <div className="space-y-4">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Connect your Google account to access your spreadsheets. You'll be redirected to Google to authorize access.
                </AlertDescription>
              </Alert>
              <GoogleSheetsOAuth onSuccess={handleOAuthSuccess} />
            </div>
          ) : (
            <div className="space-y-4">
              {state.googleSheetsConfig && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Google Sheet selected! Review the preview below, then proceed to the next step.
                  </AlertDescription>
                </Alert>
              )}
              <GoogleSheetSelector
                credentials={googleCredentials}
                onSelect={handleSheetSelect}
                initialConfig={state.googleSheetsConfig ? {
                  spreadsheetId: state.googleSheetsConfig.spreadsheet_id,
                  sheetName: state.googleSheetsConfig.sheet_name,
                  rangeConfig: {
                    start_row: state.googleSheetsConfig.start_row,
                    header_row: state.googleSheetsConfig.header_row,
                    end_row: state.googleSheetsConfig.end_row,
                    start_column: state.googleSheetsConfig.start_column,
                    end_column: state.googleSheetsConfig.end_column,
                  }
                } : undefined}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
