/**
 * Step 6: Review & Create
 * Review all configurations and create the ETL job
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Database, Columns, Clock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { calculateWizardSummary } from './utils'
import { destinationsApi } from '@/lib/api/credentials'
import { credentialsApi } from '@/lib/api/credentials'
import { usersApi } from '@/lib/api/users'
import { useAuth } from '@/contexts/AuthContext'
import type { WizardState } from './types'

interface ReviewStepProps {
  state: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
  onValidate: () => boolean
}

export function ReviewStep({ state, onUpdate }: ReviewStepProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const summary = calculateWizardSummary(state)
  const [showDDL, setShowDDL] = useState(false)

  // Fetch users list to display assigned user name
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin && !!state.assignedUserId,
  })

  const assignedUser = users.find(u => u.id === state.assignedUserId)

  // Fetch credential to get db_type for DDL generation
  // Need credential for both new tables AND truncate_insert strategy
  const needsDDL = state.destinationConfig?.createNewTable || state.loadStrategy === 'truncate_insert'

  const { data: credential } = useQuery({
    queryKey: ['credential', state.destinationConfig?.credentialId],
    queryFn: () => credentialsApi.get(state.destinationConfig!.credentialId),
    enabled: !!(state.destinationConfig?.credentialId && needsDDL),
  })

  // Generate DDL when creating a new table OR using truncate_insert strategy
  // (truncate_insert needs DDL to recreate table when schema changes)
  const { data: ddlData, isLoading: generatingDDL, error: ddlError } = useQuery({
    queryKey: ['generate-ddl', state.destinationConfig?.schema, state.destinationConfig?.tableName, state.columnMappings, state.loadStrategy],
    queryFn: async () => {
      if (!state.destinationConfig || !credential) return null

      const dbType = credential.db_type === 'redshift' ? 'redshift' : 'postgresql'

      return await destinationsApi.generateDDL(
        state.destinationConfig.schema,
        state.destinationConfig.tableName,
        state.columnMappings,
        dbType
      )
    },
    enabled: !!(
      needsDDL &&
      state.destinationConfig?.schema &&
      state.destinationConfig?.tableName &&
      state.columnMappings.length > 0 &&
      credential
    ),
  })

  // Save generated DDL to wizard state
  useEffect(() => {
    if (ddlData?.ddl && state.destinationConfig) {
      // Only update if the DDL has changed
      if (state.destinationConfig.newTableDDL !== ddlData.ddl) {
        onUpdate({
          destinationConfig: {
            ...state.destinationConfig,
            newTableDDL: ddlData.ddl,
          },
        })
      }
    }
  }, [ddlData?.ddl, state.destinationConfig, onUpdate])

  const loadStrategyLabels = {
    insert: 'Insert',
    upsert: 'Upsert',
    truncate_insert: 'Truncate & Insert',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review & Create</h2>
        <p className="text-muted-foreground mt-1">
          Review your configuration before creating the ETL job
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Source Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>Source</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{state.sourceType.toUpperCase()}</span>
            </div>
            {state.uploadedData && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File:</span>
                  <span className="font-medium truncate max-w-[200px]" title={state.uploadedData.filename}>
                    {state.uploadedData.filename}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rows:</span>
                  <span className="font-medium">{summary.totalRows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="font-medium">{summary.totalColumns}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              <CardTitle>Job Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium truncate max-w-[200px]" title={state.jobName}>
                {state.jobName}
              </span>
            </div>
            {state.jobDescription && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description:</span>
                <span className="font-medium truncate max-w-[200px]" title={state.jobDescription}>
                  {state.jobDescription}
                </span>
              </div>
            )}
            {isAdmin && assignedUser && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To:</span>
                <span className="font-medium truncate max-w-[200px]" title={assignedUser.email}>
                  {assignedUser.email}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Load Strategy:</span>
              <Badge variant="outline">{loadStrategyLabels[state.loadStrategy]}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Batch Size:</span>
              <span className="font-medium">{state.batchSize.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Destination */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Destination</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.destinationConfig ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credential ID:</span>
                  <span className="font-medium">{state.destinationConfig.credentialId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Schema:</span>
                  <span className="font-medium">{state.destinationConfig.schema}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Table:</span>
                  <span className="font-medium">{state.destinationConfig.tableName}</span>
                </div>
                {state.destinationConfig.createNewTable && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <Badge variant="secondary">Create New Table</Badge>
                  </div>
                )}
                {state.destinationConfig.upsertKeys && state.destinationConfig.upsertKeys.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Upsert Keys:</span>
                    <span className="font-medium font-mono text-xs">
                      {state.destinationConfig.upsertKeys.join(', ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground italic">Not configured</span>
            )}
          </CardContent>
        </Card>

        {/* Column Mappings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Columns className="w-5 h-5 text-primary" />
              <CardTitle>Column Mappings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Columns:</span>
              <span className="font-medium">{summary.totalColumns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium text-green-600">{summary.activeColumns}</span>
            </div>
            {summary.excludedColumns > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excluded:</span>
                <span className="font-medium text-gray-500">{summary.excludedColumns}</span>
              </div>
            )}
            {summary.calculatedColumns > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calculated:</span>
                <Badge variant="secondary">{summary.calculatedColumns}</Badge>
              </div>
            )}
            {summary.transformedColumns > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">With Transforms:</span>
                <Badge variant="secondary">{summary.transformedColumns}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle>Schedule</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.schedule ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cron Expression:</span>
                  <span className="font-mono font-medium">{state.schedule.cronExpression}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={state.schedule.enabled ? 'default' : 'secondary'}>
                    {state.schedule.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground italic">No schedule configured</span>
                <Badge variant="outline">Manual Execution Only</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DDL Preview (for new tables and truncate_insert strategy) */}
        {needsDDL && (
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <CardTitle>
                    {state.destinationConfig?.createNewTable
                      ? 'Table Creation DDL'
                      : 'Table Schema DDL (for truncate & insert)'}
                  </CardTitle>
                </div>
                {ddlData?.ddl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDDL(!showDDL)}
                  >
                    {showDDL ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide DDL
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Show DDL
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generatingDDL ? (
                <div className="flex items-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating DDL...</span>
                </div>
              ) : ddlError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to generate DDL. Please check your column mappings and try again.
                  </AlertDescription>
                </Alert>
              ) : ddlData?.ddl ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {state.destinationConfig?.createNewTable
                      ? 'This table will be created when the job first runs. Review the DDL below.'
                      : 'This DDL defines the table schema. For truncate & insert, the table will be recreated if the schema changes.'}
                  </p>
                  {showDDL && (
                    <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto max-h-96 overflow-y-auto">
                      <code className="whitespace-pre-wrap break-all">
                        {ddlData.ddl}
                      </code>
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  DDL will be generated automatically based on your column mappings.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
