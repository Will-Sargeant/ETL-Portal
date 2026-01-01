import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Database, Trash2, TestTube2, Table2, AlertTriangle, User as UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { credentialsApi, destinationsApi } from '@/lib/api/credentials'
import { useAuth } from '@/contexts/AuthContext'
import type { Credential } from '@/types/credential'

interface CredentialListProps {
  onSelectCredential?: (credential: Credential) => void
  onViewTables?: (credentialId: number) => void
}

export function CredentialList({ onSelectCredential, onViewTables }: CredentialListProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [credentialToDelete, setCredentialToDelete] = useState<{ id: number; name: string } | null>(null)
  const [userFilter, setUserFilter] = useState<string>('all')

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  // Filter credentials by user (admin only)
  const filteredCredentials = useMemo(() => {
    if (!credentials) return []
    if (userFilter === 'all' || user?.role !== 'admin') return credentials
    return credentials.filter(cred => cred.user_id?.toString() === userFilter)
  }, [credentials, userFilter, user?.role])

  // Get unique users from credentials (for filter dropdown)
  const uniqueUsers = useMemo(() => {
    if (!credentials) return []
    const userMap = new Map<number, string>()
    credentials.forEach(cred => {
      if (cred.user_id && cred.user_email) {
        userMap.set(cred.user_id, cred.user_email)
      }
    })
    return Array.from(userMap.entries()).map(([id, email]) => ({ id, email }))
  }, [credentials])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => credentialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      toast.success('Credential deleted successfully')
      setDeleteDialogOpen(false)
      setCredentialToDelete(null)
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

  const handleDeleteClick = (id: number, name: string) => {
    setCredentialToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (credentialToDelete) {
      deleteMutation.mutate(credentialToDelete.id)
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setCredentialToDelete(null)
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
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Saved Credentials</CardTitle>
            <CardDescription>
              Manage your database connections
            </CardDescription>
          </div>
          {user?.role === 'admin' && uniqueUsers.length > 0 && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredCredentials.map((credential) => (
            <div
              key={credential.id}
              className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <Database className="w-8 h-8 text-primary flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-medium truncate">{credential.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getDbTypeColor(credential.db_type)}`}>
                    {getDbTypeLabel(credential.db_type)}
                  </span>
                  {credential.user_email && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      {credential.user_email}
                    </span>
                  )}
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
                  onClick={() => handleDeleteClick(credential.id, credential.name)}
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

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Are you sure you want to delete the credential{' '}
            <span className="font-semibold">&quot;{credentialToDelete?.name}&quot;</span>?
            <br />
            <br />
            This action cannot be undone. Any ETL jobs using this credential may fail to execute.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}
