import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CredentialForm } from '@/features/credentials/CredentialForm'
import { CredentialList } from '@/features/credentials/CredentialList'
import { TableBrowser } from '@/features/credentials/TableBrowser'

export function CredentialsPage() {
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null)
  const [selectedCredentialName, setSelectedCredentialName] = useState<string>('')

  const handleSuccess = () => {
    setIsAddDialogOpen(false)
    queryClient.invalidateQueries({ queryKey: ['credentials'] })
  }

  const handleViewTables = (credentialId: number) => {
    // Get credential name from cache
    const credentials = queryClient.getQueryData<any[]>(['credentials'])
    const credential = credentials?.find((c) => c.id === credentialId)

    setSelectedCredentialId(credentialId)
    setSelectedCredentialName(credential?.name || `Credential ${credentialId}`)
  }

  const handleCloseTableBrowser = () => {
    setSelectedCredentialId(null)
    setSelectedCredentialName('')
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Database Credentials</h1>
          <p className="text-muted-foreground">
            Manage database connections for your ETL jobs
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      <CredentialList onViewTables={handleViewTables} />

      {/* Add Credential Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Database Credential</DialogTitle>
            <DialogDescription>
              Save database credentials for use in ETL jobs
            </DialogDescription>
          </DialogHeader>
          <CredentialForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      {/* Table Browser Sheet */}
      <Sheet open={selectedCredentialId !== null} onOpenChange={(open) => !open && handleCloseTableBrowser()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Browse Tables</SheetTitle>
            <SheetDescription>
              {selectedCredentialName}
            </SheetDescription>
          </SheetHeader>
          {selectedCredentialId && (
            <div className="mt-6">
              <TableBrowser
                credentialId={selectedCredentialId}
                credentialName={selectedCredentialName}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
