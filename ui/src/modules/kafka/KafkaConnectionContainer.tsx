'use client'

import { KafkaConnectionFormManager } from '@/src/modules/kafka/components/KafkaConnectionFormManager'
import { useEffect, useState, useRef } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/useKafkaConnection'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaFormDefaultValues } from '@/src/config/kafka-connection-form-config'
import type { Pipeline } from '@/src/types/pipeline'
import type { PipelineActionState } from '@/src/hooks/usePipelineActions'
import { useKafkaConnectionSave } from '@/src/modules/kafka/hooks/useKafkaConnectionSave'

export interface KafkaConnectionContainerProps {
  steps?: Record<string, { key?: string; title?: string; description?: string }>
  onCompleteStep?: (step: StepKeys) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: (apiConfig?: unknown) => void
  onCompleteStandaloneEditing?: () => void
  pipelineActionState?: PipelineActionState
  pipeline?: Pipeline
}

export function KafkaConnectionContainer({
  onCompleteStep,
  validate,
  readOnly = false,
  toggleEditMode,
  standalone,
  onCompleteStandaloneEditing,
  pipelineActionState,
  pipeline,
}: KafkaConnectionContainerProps) {
  const [clearErrorMessage, setClearErrorMessage] = useState(false)
  const { kafkaStore, topicsStore, coreStore } = useStore()
  const { topicCount } = coreStore
  const {
    authMethod,
    securityProtocol,
    bootstrapServers,
    saslPlain,
    saslGssapi,
    noAuth,
    saslScram256,
    saslScram512,
  } = kafkaStore
  const { resetTopicsStore } = topicsStore
  // ref to track previous bootstrap servers, not using state to avoid re-renders
  const previousBootstrapServers = useRef(bootstrapServers)
  const [connectionFormValues, setConnectionFormValues] = useState<KafkaConnectionFormType | null>(null)

  const analytics = useJourneyAnalytics()
  const {
    testConnection,
    connectionResult,
    kafkaConnection: kafkaConnectionFromHook,
    isConnecting: isConnectingFromHook,
  } = useKafkaConnection()

  // Use the centralized pipeline actions hook (pipeline is undefined in create-wizard flow)
  usePipelineActions(pipeline ?? ({ pipeline_id: '', status: 'stopped' } as Pipeline))

  const { saveConnectionData } = useKafkaConnectionSave({
    standalone,
    toggleEditMode,
    onCompleteStep,
    onCompleteStandaloneEditing,
  })

  // Prepare initial values by merging defaults with store values
  const initialValues = {
    ...KafkaFormDefaultValues,
    authMethod: (authMethod || KafkaFormDefaultValues.authMethod) as KafkaConnectionFormType['authMethod'],
    securityProtocol: securityProtocol || KafkaFormDefaultValues.securityProtocol,
    bootstrapServers: bootstrapServers || KafkaFormDefaultValues.bootstrapServers,
    saslPlain: saslPlain || KafkaFormDefaultValues.saslPlain,
    saslGssapi: saslGssapi || KafkaFormDefaultValues.saslGssapi,
    noAuth: noAuth || KafkaFormDefaultValues.noAuth,
    saslScram256: saslScram256 || KafkaFormDefaultValues.saslScram256,
    saslScram512: saslScram512 || KafkaFormDefaultValues.saslScram512,
  } as KafkaConnectionFormType

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
    if (coreStore.topicCount && coreStore.topicCount > 0) {
      analytics.page.setupKafkaConnection({})
    }
  }, [topicCount, analytics.page])

  // runs after successful test connection or failed test connection in the parent
  useEffect(() => {
    if (connectionResult) {
      if (connectionResult.success) {
        // Track successful Kafka connection
        analytics.kafka.success({
          authMethod: connectionFormValues?.authMethod,
          securityProtocol: connectionFormValues?.securityProtocol,
          connectionTime: isConnectingFromHook ? Date.now() : undefined,
        })
        // No need to manually submit form - data is already saved and step is completed
      } else {
        // Track failed Kafka connection
        analytics.kafka.failed({
          authMethod: connectionFormValues?.authMethod,
          securityProtocol: connectionFormValues?.securityProtocol,
          error: connectionResult.message,
        })
      }
    }
  }, [connectionResult, connectionFormValues, isConnectingFromHook, analytics.kafka])

  const handleTestConnection = async (values: KafkaConnectionFormType) => {
    // Track attempt to test connection
    analytics.kafka.started({
      authMethod: values.authMethod,
      securityProtocol: values.securityProtocol,
    })

    // save local version of the form values to be used in the analytics
    setConnectionFormValues(values)

    const result = await testConnection(values)

    // Only save data and complete step if connection was successful
    if (result.success) {
      saveConnectionData(values)
      analytics.kafka.success({
        authMethod: values.authMethod,
        securityProtocol: values.securityProtocol,
      })
    } else {
      analytics.kafka.failed({
        authMethod: values.authMethod,
        securityProtocol: values.securityProtocol,
        error: result.message,
      })
    }
  }

  const handleDiscardConnectionChange = () => {
    setClearErrorMessage(true)
  }

  const handleFormSubmit = async () => {
    // When save is clicked in edit mode, just close the modal
    // Changes are already saved to the store by the form manager
    // The actual backend update happens when user clicks Resume
    if (onCompleteStandaloneEditing) {
      onCompleteStandaloneEditing()
    }
  }

  return (
    <>
      <KafkaConnectionFormManager
        onTestConnection={handleTestConnection}
        onDiscardConnectionChange={handleDiscardConnectionChange}
        isConnecting={isConnectingFromHook}
        connectionResult={connectionResult}
        readOnly={readOnly}
        standalone={standalone}
        initialValues={initialValues}
        authMethod={authMethod}
        securityProtocol={securityProtocol}
        bootstrapServers={bootstrapServers}
        toggleEditMode={toggleEditMode}
        pipelineActionState={pipelineActionState}
        onClose={onCompleteStandaloneEditing}
      />
      {/* {connectionResult && !clearErrorMessage && (
        <ActionStatusMessage message={connectionResult.message} success={connectionResult.success} />
      )} */}
    </>
  )
}
