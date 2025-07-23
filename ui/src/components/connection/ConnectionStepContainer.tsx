'use client'

import { useState, useEffect, useRef } from 'react'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import ActionStatusMessage from '@/src/components/shared/ActionStatusMessage'

interface ConnectionStepContainerProps {
  stepType: 'kafka' | 'clickhouse' | 'database'
  onComplete: (data: any) => void
  onTestConnection: (data: any) => Promise<boolean>
  readOnly?: boolean
  standalone?: boolean
  initialData?: any
  children: React.ReactNode
  analyticsContext?: {
    operation?: string
    page?: string
  }
}

export function ConnectionStepContainer({
  stepType,
  onComplete,
  onTestConnection,
  readOnly = false,
  standalone = false,
  initialData,
  children,
  analyticsContext,
}: ConnectionStepContainerProps) {
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const analytics = useJourneyAnalytics()

  // Track when user starts entering connection details
  useEffect(() => {
    analytics.page.setupConnection({
      stepType,
      operation: analyticsContext?.operation,
    })
  }, [stepType, analyticsContext?.operation, analytics.page])

  const handleTestConnection = async (values: any) => {
    setError(null)
    setIsConnecting(true)

    try {
      // Track connection attempt
      analytics.connection.started({
        stepType,
        operation: analyticsContext?.operation,
      })

      const result = await onTestConnection(values)

      if (result) {
        setConnectionResult({ success: true, message: 'Connection successful' })

        // Track successful connection
        analytics.connection.success({
          stepType,
          operation: analyticsContext?.operation,
          retryCount,
        })

        onComplete(values)
      } else {
        throw new Error('Connection failed')
      }
    } catch (err: any) {
      setRetryCount((prev) => prev + 1)
      setError(err.message)
      setConnectionResult({ success: false, message: err.message })

      // Track connection failure
      analytics.connection.failed({
        stepType,
        operation: analyticsContext?.operation,
        errorType: err.name || 'Unknown',
        errorMessage: err.message,
        retryCount,
      })
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <>
      {children}
      {connectionResult && (
        <ActionStatusMessage message={connectionResult.message} success={connectionResult.success} />
      )}
    </>
  )
}
