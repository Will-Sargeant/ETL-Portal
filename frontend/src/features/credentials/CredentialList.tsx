import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Database, Trash2, TestTube2, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { credentialsApi, destinationsApi } from '@/lib/api/credentials'
import type { Credential } from '@/types/credential'

interface CredentialListProps {
  onSelectCredential?: (credential: Credential) => void
  onViewTables?: (credentialId: number) => void
}

export function CredentialList({ onSelectCredential, onViewTables }: CredentialListProps) {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => credentialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      toast.success('Credential deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete credential'
      toast.error(message)
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => destinationsApi.testSavedCredential(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Connection successful! ${data.server_version || ''}`)
      } else {
        toast.error(data.message)
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Connection test failed'
      toast.error(message)
    },
  })

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete credential "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const getDbTypeLabel = (type: string) => {
    return type === 'postgresql' ? 'PostgreSQL' : 'Amazon Redshift'
  }

  const getDbTypeColor = (type: string) => {
    return type === 'postgresql'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading credentials...</p>
        </CardContent>
      </Card>
    )
  }

  if (!credentials || credentials.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No credentials yet</p>
          <p className="text-sm text-muted-foreground">
            Add a database credential to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Credentials</CardTitle>
        <CardDescription>
          Manage your database connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {credentials.map((credential) => (
            <div
              key={credential.id}
              className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <Database className="w-8 h-8 text-primary flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">{credential.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getDbTypeColor(credential.db_type)}`}>
                    {getDbTypeLabel(credential.db_type)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {credential.username}@{credential.host}:{credential.port}/{credential.database}
                </p>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => testMutation.mutate(credential.id)}
                  disabled={testMutation.isPending}
                  title="Test connection"
                >
                  <TestTube2 className="w-4 h-4" />
                </Button>

                {onViewTables && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewTables(credential.id)}
                    title="View tables"
                  >
                    <Table2 className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(credential.id, credential.name)}
                  disabled={deleteMutation.isPending}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
