import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const hasSentMessage = useRef(false)

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasSentMessage.current) {
      console.log('GoogleCallback - Message already sent, skipping')
      return
    }
    
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    console.log('GoogleCallback - Full URL:', window.location.href)
    console.log('GoogleCallback - Code:', code)
    console.log('GoogleCallback - Error:', error)
    console.log('GoogleCallback - window.opener exists:', !!window.opener)
    console.log('GoogleCallback - Origin:', window.location.origin)

    if (code) {
      hasSentMessage.current = true
      console.log('Sending GOOGLE_OAUTH_SUCCESS message to parent')
      
      // Send code to parent window
      window.opener?.postMessage(
        { type: 'GOOGLE_OAUTH_SUCCESS', code },
        window.location.origin
      )
      console.log('Message sent successfully')
    } else if (error) {
      hasSentMessage.current = true
      console.log('Sending GOOGLE_OAUTH_ERROR message to parent:', error)
      
      // Send error to parent window
      window.opener?.postMessage(
        { type: 'GOOGLE_OAUTH_ERROR', error },
        window.location.origin
      )
    } else {
      console.warn('No code or error parameter found in URL')
    }
  }, [searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Completing authentication...</p>
    </div>
  )
}
