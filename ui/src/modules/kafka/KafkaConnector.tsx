'use client'

import { KafkaConnectionForm } from '@/src/modules/kafka/components/KafkaConnectionForm'
import { use, useEffect, useState, useRef } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/useKafkaConnection'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import ActionStatusMessage from '@/src/components/shared/ActionStatusMessage'

export function KafkaConnector({
  steps,
  onCompleteStep,
  validate,
  readOnly = false,
  onEnableEdit,
  onDisableEdit,
  standalone,
}: {
  steps: any
  onCompleteStep?: (step: StepKeys, standalone?: boolean) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  onComplete?: () => void
  readOnly?: boolean
  onEnableEdit?: () => void
  onDisableEdit?: () => void
}) {
  const { kafkaStore, topicsStore, configStore } = useStore()
  const { operationsSelected } = configStore
  const { bootstrapServers } = kafkaStore
  const { resetTopicsStore } = topicsStore
  // ref to track previous bootstrap servers, not using state to avoid re-renders
  const previousBootstrapServers = useRef(bootstrapServers)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const analytics = useJourneyAnalytics()

  const {
    testConnection,
    connectionResult,
    kafkaConnection: kafkaConnectionFromHook,
    isConnecting: isConnectingFromHook,
  } = useKafkaConnection()

  // Monitor changes to bootstrapServers
  useEffect(() => {
    if (previousBootstrapServers.current !== bootstrapServers) {
      // Source has changed, perform cleanup
      resetTopicsStore()

      // Update the ref to track the new source
      previousBootstrapServers.current = bootstrapServers
    }
  }, [bootstrapServers])

  // Track when user starts entering connection details
  useEffect(() => {
    analytics.page.setupKafkaConnection({})
  }, [operationsSelected?.operation, analytics.page])

  const handleTestConnection = async (values: any) => {
    await testConnection(values)
  }

  // NOTE: unused method, remove it if the need does not arise
  const handleConnect = async () => {
    setError(null)

    try {
      // Track when user starts entering connection details
      analytics.kafka.started({
        operation: operationsSelected?.operation,
      })

      const result = await validate()

      if (result) {
        // Track successful connection
        analytics.kafka.success({
          operation: operationsSelected?.operation,
          retryCount,
        })
        onCompleteStep?.(StepKeys.TOPIC_SELECTION_1)
      }
    } catch (err: any) {
      setRetryCount((prev) => prev + 1)
      setError(err.message)

      // Track connection failure with specific error type
      analytics.kafka.failed({
        operation: operationsSelected?.operation,
        errorType: err.name || 'Unknown',
        errorMessage: err.message,
        retryCount,
      })
    }
  }

  // Track validation errors
  const handleValidationError = (error: string) => {
    // TODO: track validation error
  }

  return (
    <>
      <KafkaConnectionForm
        // @ts-expect-error - FIXME: fix this later
        onTestConnection={handleTestConnection}
        isConnecting={isConnectingFromHook}
        connectionResult={connectionResult}
        onCompleteStep={onCompleteStep}
        readOnly={readOnly}
        onEnableEdit={onEnableEdit}
        onDisableEdit={onDisableEdit}
        standalone={standalone}
      />
      {connectionResult && (
        <ActionStatusMessage message={connectionResult.message} success={connectionResult.success} />
      )}
    </>
  )
}
