import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export function GoogleCallback() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (code) {
      // Send code to parent window
      window.opener?.postMessage(
        { type: 'GOOGLE_OAUTH_SUCCESS', code },
        window.location.origin
      )
    } else if (error) {
      // Send error to parent window
      window.opener?.postMessage(
        { type: 'GOOGLE_OAUTH_ERROR', error },
        window.location.origin
      )
    }
  }, [searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Completing authentication...</p>
    </div>
  )
}
