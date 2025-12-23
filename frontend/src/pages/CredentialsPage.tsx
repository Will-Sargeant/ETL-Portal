import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CredentialForm } from '@/features/credentials/CredentialForm'
import { CredentialList } from '@/features/credentials/CredentialList'
import { TableBrowser } from '@/features/credentials/TableBrowser'

export function CredentialsPage() {
  const queryClient = useQueryClient()
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null)
  const [selectedCredentialName, setSelectedCredentialName] = useState<string>('')

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['credentials'] })
  }

  const handleViewTables = (credentialId: number) => {
    // Get credential name from cache
    const credentials = queryClient.getQueryData<any[]>(['credentials'])
    const credential = credentials?.find((c) => c.id === credentialId)

    setSelectedCredentialId(credentialId)
    setSelectedCredentialName(credential?.name || `Credential ${credentialId}`)
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Database Credentials</h1>
        <p className="text-muted-foreground">
          Manage database connections for your ETL jobs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <CredentialForm onSuccess={handleSuccess} />
          <CredentialList onViewTables={handleViewTables} />
        </div>

        <div>
          {selectedCredentialId ? (
            <TableBrowser
              credentialId={selectedCredentialId}
              credentialName={selectedCredentialName}
            />
          ) : (
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <p className="text-muted-foreground">
                Click "View Tables" on a credential to browse its tables
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
