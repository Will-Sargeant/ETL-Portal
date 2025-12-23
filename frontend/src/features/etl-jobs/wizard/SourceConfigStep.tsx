import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { sourcesApi } from '@/lib/api/sources'
import type { ETLJobCreate } from '@/types/etl-job'

interface SourceConfigStepProps {
  data: Partial<ETLJobCreate>
  onChange: (updates: Partial<ETLJobCreate>) => void
}

export function SourceConfigStep({ data, onChange }: SourceConfigStepProps) {
  const [selectedFile, setSelectedFile] = useState<string>(
    data.source_config?.file_path || ''
  )

  // For now, we'll just show a file path input
  // In a real implementation, you might fetch available uploaded files
  const { data: uploadedFiles, isLoading } = useQuery({
    queryKey: ['uploaded-files'],
    queryFn: async () => {
      // This is a placeholder - you would implement a proper file listing endpoint
      return []
    },
    enabled: false, // Disabled for now
  })

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
    onChange({
      source_config: {
        ...data.source_config,
        file_path: filePath,
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="source_type">Source Type</Label>
        <Select
          value={data.source_type || 'csv'}
          onValueChange={(value: 'csv' | 'google_sheets') =>
            onChange({ source_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV File</SelectItem>
            <SelectItem value="google_sheets" disabled>
              Google Sheets (Coming Soon)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.source_type === 'csv' && (
        <div className="space-y-2">
          <Label htmlFor="file_path">CSV File Path *</Label>
          <input
            id="file_path"
            type="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="/app/uploads/myfile.csv"
            value={selectedFile}
            onChange={(e) => handleFileSelect(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter the full path to your uploaded CSV file
          </p>

          {selectedFile && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">Selected File</p>
                  <p className="text-sm text-muted-foreground">{selectedFile}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Upload your CSV file first using the CSV Upload page, then use
          the file path shown in the upload confirmation.
        </p>
      </div>
    </div>
  )
}
