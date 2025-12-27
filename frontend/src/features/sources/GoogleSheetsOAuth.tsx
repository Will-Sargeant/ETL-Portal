import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

interface GoogleSheetsOAuthProps {
  onSuccess: (credentials: string) => void
}

export function GoogleSheetsOAuth({ onSuccess }: GoogleSheetsOAuthProps) {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      // Get authorization URL
      const { data } = await apiClient.get('/google/auth-url')

      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        data.auth_url,
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for OAuth callback
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
          popup?.close()

          // Exchange code for credentials
          const response = await apiClient.post('/google/callback', {
            code: event.data.code
          })

          onSuccess(response.data.credentials)
          toast.success('Connected to Google Sheets', {
            description: 'You can now select spreadsheets',
          })

          // Clean up event listener
          window.removeEventListener('message', messageHandler)
        } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
          popup?.close()
          toast.error('Connection Failed', {
            description: event.data.error || 'Failed to connect to Google Sheets',
          })

          // Clean up event listener
          window.removeEventListener('message', messageHandler)
        }
      }

      window.addEventListener('message', messageHandler)

    } catch (error) {
      toast.error('Connection Failed', {
        description: 'Failed to connect to Google Sheets',
      })
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Button onClick={handleConnect} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Google Sheets'}
    </Button>
  )
}
