import { useQuery } from '@tanstack/react-query'
import { Database, Loader2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { credentialsApi } from '@/lib/api/credentials'
import type { ETLJobCreate, LoadStrategy } from '@/types/etl-job'

interface DestinationConfigStepProps {
  data: Partial<ETLJobCreate>
  onChange: (updates: Partial<ETLJobCreate>) => void
}

export function DestinationConfigStep({ data, onChange }: DestinationConfigStepProps) {
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  const selectedCredential = credentials?.find(
    (c) => c.id === data.destination_config?.credential_id
  )

  const handleCredentialChange = (credentialId: string) => {
    const credential = credentials?.find((c) => c.id === parseInt(credentialId))
    onChange({
      destination_config: {
        ...data.destination_config,
        credential_id: parseInt(credentialId),
      },
      destination_type: credential?.db_type === 'postgresql' ? 'postgresql' : 'redshift',
    })
  }

  const handleTableChange = (value: string, field: 'schema_name' | 'table_name') => {
    onChange({
      destination_config: {
        ...data.destination_config,
        [field]: value,
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="credential">Database Credential *</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 p-3 border rounded-md">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading credentials...</span>
          </div>
        ) : credentials && credentials.length > 0 ? (
          <Select
            value={data.destination_config?.credential_id?.toString() || ''}
            onValueChange={handleCredentialChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a credential" />
            </SelectTrigger>
            <SelectContent>
              {credentials.map((credential) => (
                <SelectItem key={credential.id} value={credential.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    {credential.name} ({credential.db_type})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="p-4 border rounded-md bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No credentials found. Please create a credential first on the Credentials page.
            </p>
          </div>
        )}
      </div>

      {selectedCredential && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">{selectedCredential.name}</p>
              <p className="text-muted-foreground">
                {selectedCredential.username}@{selectedCredential.host}:
                {selectedCredential.port}/{selectedCredential.database}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="schema_name">Schema Name *</Label>
          <Input
            id="schema_name"
            placeholder="public"
            value={data.destination_config?.schema_name || ''}
            onChange={(e) => handleTableChange(e.target.value, 'schema_name')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table_name">Table Name *</Label>
          <Input
            id="table_name"
            placeholder="my_table"
            value={data.destination_config?.table_name || ''}
            onChange={(e) => handleTableChange(e.target.value, 'table_name')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="load_strategy">Load Strategy</Label>
        <Select
          value={data.load_strategy || 'insert'}
          onValueChange={(value: LoadStrategy) => onChange({ load_strategy: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="insert">Insert (Append new rows)</SelectItem>
            <SelectItem value="upsert">Upsert (Insert or update existing)</SelectItem>
            <SelectItem value="truncate_insert">
              Truncate & Insert (Replace all data)
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {data.load_strategy === 'insert' &&
            'Append new rows to the table without modifying existing data'}
          {data.load_strategy === 'upsert' &&
            'Insert new rows or update existing ones based on key columns'}
          {data.load_strategy === 'truncate_insert' &&
            'Delete all existing data and insert new rows'}
        </p>
      </div>

      {data.load_strategy === 'upsert' && (
        <div className="space-y-2">
          <Label htmlFor="upsert_keys">Upsert Key Columns</Label>
          <Input
            id="upsert_keys"
            placeholder="id, email (comma-separated)"
            value={data.upsert_keys?.join(', ') || ''}
            onChange={(e) =>
              onChange({
                upsert_keys: e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter((k) => k),
              })
            }
          />
          <p className="text-sm text-muted-foreground">
            Column(s) used to identify existing rows for upsert
          </p>
        </div>
      )}
    </div>
  )
}
