import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CSVUpload } from '@/features/sources/CSVUpload'
import { DataPreview } from '@/features/sources/DataPreview'
import { JobDetailsForm } from '@/features/sources/JobDetailsForm'
import { JobConfigurationWizard } from '@/features/sources/JobConfigurationWizard'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { UploadResponse, JobConfiguration, ColumnMappingConfig } from '@/types/source'
import type { ETLJobCreate } from '@/types/etl-job'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import { autoMapColumns } from '@/lib/utils/column-mapper'

// Helper function to map CSV types to SQL types
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

export function CSVUploadPage() {
  const navigate = useNavigate()
  const [uploadedData, setUploadedData] = useState<UploadResponse | null>(null)
  const [showJobConfig, setShowJobConfig] = useState(false)
  const [currentStep, setCurrentStep] = useState<2 | 3>(2)

  const [jobConfig, setJobConfig] = useState<JobConfiguration>({
    jobName: '',
    jobDescription: '',
    destination: null,
    tableSchema: null,
    columnMappings: [],
    schedule: null,
    batchSize: 10000,
  })

  // Helper for partial updates
  const updateJobConfig = (updates: Partial<JobConfiguration>) => {
    setJobConfig((prev) => ({ ...prev, ...updates }))
  }

  // Auto-populate job name when file is uploaded
  useEffect(() => {
    if (uploadedData && !jobConfig.jobName) {
      updateJobConfig({ jobName: `ETL Job - ${uploadedData.filename}` })
    }
  }, [uploadedData, jobConfig.jobName])

  // Auto-generate column mappings for new tables
  useEffect(() => {
    if (
      jobConfig.destination?.createNewTable &&
      uploadedData &&
      jobConfig.columnMappings.length === 0
    ) {
      const initialMappings: ColumnMappingConfig[] = uploadedData.columns.map((col, index) => ({
        sourceColumn: col.name,
        destinationColumn: col.name,
        sourceType: mapCsvTypeToSql(col.data_type),
        destinationType: mapCsvTypeToSql(col.data_type),
        transformation: undefined,
        isNullable: true,
        defaultValue: undefined,
        exclude: false,
        isCalculated: false,
        columnOrder: index,
        isPrimaryKey: false,
      }))
      updateJobConfig({ columnMappings: initialMappings })
    }
  }, [jobConfig.destination?.createNewTable, uploadedData, jobConfig.columnMappings.length])

  // Auto-map columns when table schema is fetched
  useEffect(() => {
    if (jobConfig.tableSchema && uploadedData) {
      const autoMapped = autoMapColumns(uploadedData.columns, jobConfig.tableSchema.columns)
      updateJobConfig({ columnMappings: autoMapped })
    }
  }, [jobConfig.tableSchema, uploadedData])

  const createMutation = useMutation({
    mutationFn: (data: ETLJobCreate) => etlJobsApi.create(data),
    onSuccess: (job) => {
      toast.success(`Job "${job.name}" created successfully`)
      navigate('/etl-jobs')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create job')
    },
  })

  const createAndExecuteMutation = useMutation({
    mutationFn: async (data: ETLJobCreate) => {
      const job = await etlJobsApi.create(data)
      await etlJobsApi.execute(job.id)
      return job
    },
    onSuccess: (job) => {
      toast.success(`Job "${job.name}" created and started`)
      navigate(`/etl-jobs/${job.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create and execute job')
    },
  })

  const handleJobComplete = (runImmediately: boolean) => {
    // Validate job name
    if (!jobConfig.jobName.trim()) {
      toast.error('Job name is required')
      return
    }

    // Build job config
    const jobData: ETLJobCreate = {
      name: jobConfig.jobName,
      description: jobConfig.jobDescription,
      source_type: 'csv',
      source_config: {
        file_id: uploadedData!.file_id,
        filename: uploadedData!.filename,
      },
      destination_type: 'postgresql',
      destination_config: {
        credential_id: jobConfig.destination!.credentialId,
        schema: jobConfig.destination!.schema,
        table: jobConfig.destination!.tableName,
      },
      load_strategy: jobConfig.destination!.loadStrategy,
      upsert_keys: jobConfig.destination!.upsertKeys,
      batch_size: jobConfig.batchSize,
      column_mappings: jobConfig.columnMappings.map((m) => ({
        source_column: m.sourceColumn,
        destination_column: m.destinationColumn!,
        source_type: m.sourceType,
        destination_type: m.destinationType!,
        transformation: m.transformation,
        is_nullable: m.isNullable,
        default_value: m.defaultValue,
        exclude: m.exclude,
        is_calculated: m.isCalculated,
        expression: m.expression,
        column_order: m.columnOrder,
        is_primary_key: m.isPrimaryKey,
      })),
      schedule: jobConfig.schedule
        ? {
            cron_expression: jobConfig.schedule.cronExpression,
            enabled: jobConfig.schedule.enabled,
          }
        : undefined,
      create_new_table: jobConfig.destination!.createNewTable,
      new_table_ddl: jobConfig.destination!.newTableDDL,
    }

    if (runImmediately) {
      createAndExecuteMutation.mutate(jobData)
    } else {
      createMutation.mutate(jobData)
    }
  }

  const handleUploadAnother = () => {
    setUploadedData(null)
    setJobConfig({
      jobName: '',
      jobDescription: '',
      destination: null,
      tableSchema: null,
      columnMappings: [],
      schedule: null,
      batchSize: 10000,
    })
    setCurrentStep(2)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload CSV File</h1>
        <p className="text-muted-foreground">Upload a CSV file to configure an ETL job</p>
      </div>

      {/* Hide upload card if data is already uploaded */}
      {!uploadedData && <CSVUpload onUploadSuccess={setUploadedData} />}

      {/* Show job details and preview when file is uploaded */}
      {uploadedData && (
        <>
          <JobDetailsForm
            jobName={jobConfig.jobName}
            jobDescription={jobConfig.jobDescription}
            onJobNameChange={(name) => updateJobConfig({ jobName: name })}
            onJobDescriptionChange={(desc) => updateJobConfig({ jobDescription: desc })}
          />

          <DataPreview
            data={uploadedData.preview}
            filename={uploadedData.filename}
            actions={
              <div className="flex gap-3">
                <Button onClick={() => setShowJobConfig(true)} size="lg">
                  Configure ETL Job
                </Button>
                <Button variant="outline" onClick={handleUploadAnother} size="lg">
                  Upload Another File
                </Button>
              </div>
            }
          />
        </>
      )}

      {/* Job Configuration Wizard in Side Drawer */}
      <Sheet open={showJobConfig} onOpenChange={setShowJobConfig}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Configure ETL Job - Step {currentStep} of 3</SheetTitle>
            <SheetDescription>
              {currentStep === 2 && 'Select destination and configure column mappings'}
              {currentStep === 3 && 'Set schedule and finalize job configuration'}
            </SheetDescription>
          </SheetHeader>

          <JobConfigurationWizard
            uploadedData={uploadedData!}
            currentStep={currentStep}
            jobConfig={jobConfig}
            onJobConfigChange={updateJobConfig}
            onStepChange={setCurrentStep}
            onComplete={handleJobComplete}
            onCancel={() => setShowJobConfig(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
