import { useEffect, useState, useRef } from 'react'
import type { JobRunResponse } from '@/types/schedule'

interface ProgressUpdate extends JobRunResponse {
  progress_percentage?: number
  rows_processed?: number
  rows_total?: number
}

interface UseJobRunProgressOptions {
  jobRunId: number
  enabled?: boolean
  onComplete?: (data: ProgressUpdate) => void
  onFailed?: (data: ProgressUpdate) => void
  onError?: (error: string) => void
}

export function useJobRunProgress({
  jobRunId,
  enabled = true,
  onComplete,
  onFailed,
  onError,
}: UseJobRunProgressOptions) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!enabled || !jobRunId) {
      return
    }

    // Get API base URL from environment
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const eventSourceUrl = `${apiUrl}/api/v1/job-runs/${jobRunId}/stream`

    // Create EventSource connection
    const eventSource = new EventSource(eventSourceUrl)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    // Handle progress updates
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressUpdate
        setProgress(data)
      } catch (err) {
        console.error('Failed to parse progress event:', err)
      }
    })

    // Handle completion
    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressUpdate
        setProgress(data)
        if (onComplete) {
          onComplete(data)
        }
        eventSource.close()
        setIsConnected(false)
      } catch (err) {
        console.error('Failed to parse complete event:', err)
      }
    })

    // Handle failure
    eventSource.addEventListener('failed', (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressUpdate
        setProgress(data)
        if (onFailed) {
          onFailed(data)
        }
        eventSource.close()
        setIsConnected(false)
      } catch (err) {
        console.error('Failed to parse failed event:', err)
      }
    })

    // Handle errors
    eventSource.addEventListener('error', (event: any) => {
      const errorMessage = event.data
        ? JSON.parse(event.data).error
        : 'Connection error'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
      eventSource.close()
      setIsConnected(false)
    })

    eventSource.onerror = () => {
      const errorMessage = 'Failed to connect to progress stream'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
      eventSource.close()
      setIsConnected(false)
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [jobRunId, enabled, onComplete, onFailed, onError])

  return {
    progress,
    isConnected,
    error,
    disconnect: () => {
      eventSourceRef.current?.close()
      setIsConnected(false)
    },
  }
}
