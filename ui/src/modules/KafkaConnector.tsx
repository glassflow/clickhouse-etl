'use client'

import { KafkaConnectionForm } from '@/src/components/wizard/kafka/KafkaConnectionForm'
import { use, useEffect, useState, useRef } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/kafka-mng-hooks'
import { useAnalytics } from '@/src/hooks/useAnalytics'

export function KafkaConnector({
  steps,
  onNext,
  validate,
}: {
  steps: any
  onNext: (step: StepKeys) => void
  validate: () => Promise<boolean>
}) {
  const { kafkaStore, topicsStore, operationsSelected } = useStore()
  const { bootstrapServers } = kafkaStore
  const { resetStore: resetTopicsStore } = topicsStore
  // ref to track previous bootstrap servers, not using state to avoid re-renders
  const previousBootstrapServers = useRef(bootstrapServers)
  const { trackFunnelStep, trackError } = useAnalytics()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const { testConnection, connectionResult, kafkaConnection: kafkaConnectionFromHook } = useKafkaConnection()

  // Monitor changes to bootstrapServers
  useEffect(() => {
    if (previousBootstrapServers.current !== bootstrapServers) {
      // Source has changed, perform cleanup
      console.log('Kafka source changed from', previousBootstrapServers.current, 'to', bootstrapServers)

      resetTopicsStore()

      // Update the ref to track the new source
      previousBootstrapServers.current = bootstrapServers
    }
  }, [bootstrapServers])

  // Track when user starts entering connection details
  useEffect(() => {
    trackFunnelStep('kafkaConnectionStarted', {
      operation: operationsSelected?.operation,
    })
  }, [operationsSelected?.operation, trackFunnelStep])

  const handleTestConnection = async (values: any) => {
    console.log('args', values)
    await testConnection(values)
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Track connection attempt
      trackFunnelStep('kafkaConnectionAttempt', {
        attempt: retryCount + 1,
        operation: operationsSelected?.operation,
      })

      const result = await validate()

      if (result) {
        // Track successful connection
        trackFunnelStep('kafkaConnectionSuccess', {
          operation: operationsSelected?.operation,
          retryCount,
        })
        onNext(StepKeys.TOPIC_SELECTION_1)
      }
    } catch (err: any) {
      setRetryCount((prev) => prev + 1)
      setError(err.message)

      // Track connection failure with specific error type
      trackFunnelStep('kafkaConnectionFailed', {
        operation: operationsSelected?.operation,
        errorType: err.name || 'Unknown',
        errorMessage: err.message,
        retryCount,
      })

      // Track error for error analysis
      trackError('connection', {
        type: 'kafka_connection',
        error: err.message,
        retryCount,
      })
    } finally {
      setIsConnecting(false)
    }
  }

  // Track validation errors
  const handleValidationError = (error: string) => {
    trackError('validation', {
      type: 'kafka_connection',
      field: error,
    })
  }

  return (
    <>
      <KafkaConnectionForm
        // @ts-expect-error - FIXME: fix this later
        onTestConnection={handleTestConnection}
        isConnecting={isConnecting}
        connectionResult={connectionResult}
        onNext={onNext}
      />
      {connectionResult && (
        <div
          className={`mt-4 p-3 rounded ${connectionResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {connectionResult.message}
        </div>
      )}
    </>
  )
}
