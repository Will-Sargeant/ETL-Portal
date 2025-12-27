/**
 * Step 1: Source Selection
 * Upload CSV or connect to Google Sheets (future)
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon } from 'lucide-react'

import { CSVUpload } from '@/features/sources/CSVUpload'
import { DataPreview } from '@/features/sources/DataPreview'
import type { UploadResponse } from '@/types/source'
import type { WizardState } from './types'
import { autoPopulateFromCSV } from './utils'

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

  const handleUploadSuccess = (data: UploadResponse) => {
    const updates = autoPopulateFromCSV(data)
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
          <TabsTrigger value="google_sheets" disabled>
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

        <TabsContent value="google_sheets" className="mt-6">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Google Sheets integration coming soon! For now, please use CSV upload.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}
