import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { credentialsApi, destinationsApi } from '@/lib/api/credentials'
import { usersApi } from '@/lib/api/users'
import { useAuth } from '@/contexts/AuthContext'
import type { CredentialCreate, DatabaseType, ConnectionTestResponse } from '@/types/credential'

interface CredentialFormProps {
  onSuccess?: () => void
}

export function CredentialForm({ onSuccess }: CredentialFormProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [formData, setFormData] = useState<CredentialCreate>({
    name: '',
    db_type: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl_mode: 'prefer',
    user_id: user?.id, // Default to current user
  })

  const [testResult, setTestResult] = useState<ConnectionTestResponse | null>(null)

  // Fetch users list (admin only)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  const testMutation = useMutation({
    mutationFn: () => destinationsApi.testConnection(formData),
    onSuccess: (data) => {
      setTestResult(data)
      if (data.success) {
        toast.success('Connection test successful!')
      } else {
        toast.error(data.message)
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Connection test failed'
      toast.error(message)
      setTestResult({ success: false, message })
    },
  })

  const createMutation = useMutation({
    mutationFn: () => credentialsApi.create(formData),
    onSuccess: () => {
      toast.success('Credential saved successfully!')
      setFormData({
        name: '',
        db_type: 'postgresql',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssl_mode: 'prefer',
        user_id: user?.id, // Reset to current user
      })
      setTestResult(null)
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to save credential'
      toast.error(message)
    },
  })

  const handleDbTypeChange = (value: DatabaseType) => {
    setFormData({
      ...formData,
      db_type: value,
      port: value === 'postgresql' ? 5432 : 5439,
    })
    setTestResult(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  const handleTest = () => {
    testMutation.mutate()
  }

  const isFormValid = formData.name && formData.host && formData.database && formData.username && formData.password

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Credential Name *</Label>
              <Input
                id="name"
                placeholder="Production DB"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="assign-to">Assign To</Label>
                <Select
                  value={formData.user_id?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, user_id: parseInt(value) })}
                >
                  <SelectTrigger id="assign-to">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.email} {u.full_name ? `(${u.full_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="db_type">Database Type *</Label>
              <Select value={formData.db_type} onValueChange={handleDbTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="redshift">Amazon Redshift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">Host *</Label>
              <Input
                id="host"
                placeholder="localhost"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="database">Database *</Label>
              <Input
                id="database"
                placeholder="my_database"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssl_mode">SSL Mode</Label>
              <Select
                value={formData.ssl_mode}
                onValueChange={(value) => setFormData({ ...formData, ssl_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disable">Disable</SelectItem>
                  <SelectItem value="prefer">Prefer (Default)</SelectItem>
                  <SelectItem value="require">Require</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                placeholder="postgres"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm space-y-1">
                <div>{testResult.message}</div>
                {testResult.server_version && (
                  <div className="text-xs opacity-80">{testResult.server_version}</div>
                )}
                {testResult.connection_time_ms && (
                  <div className="text-xs opacity-80">
                    Connection time: {testResult.connection_time_ms}ms
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!isFormValid || testMutation.isPending}
            >
              {testMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || createMutation.isPending || !testResult?.success}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Credential
            </Button>
          </div>
        </form>
  )
}
