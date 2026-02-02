'use client'

import { KafkaConnectionFormManager } from '@/src/modules/kafka/components/KafkaConnectionFormManager'
import { use, useEffect, useState, useRef } from 'react'
import { StepKeys, AUTH_OPTIONS } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/useKafkaConnection'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import ActionStatusMessage from '@/src/components/shared/ActionStatusMessage'
import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaFormDefaultValues } from '@/src/config/kafka-connection-form-config'
import { connectionFormToRequestBody } from '@/src/modules/kafka/utils/connectionToRequestBody'
import type { Pipeline } from '@/src/types/pipeline'
import type { PipelineActionState } from '@/src/hooks/usePipelineActions'

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
    setKafkaAuthMethod,
    setKafkaSecurityProtocol,
    setKafkaBootstrapServers,
    setKafkaNoAuth,
    setKafkaSaslPlain,
    setKafkaSaslJaas,
    setKafkaSaslGssapi,
    setKafkaSaslOauthbearer,
    setKafkaSaslScram256,
    setKafkaSaslScram512,
    setKafkaDelegationTokens,
    setKafkaConnection,
    // setKafkaSkipAuth,
    isConnected,
    authMethod,
    securityProtocol,
    bootstrapServers,
    saslPlain,
    saslJaas,
    saslGssapi,
    saslOauthbearer,
    saslScram256,
    saslScram512,
    delegationTokens,
    noAuth,
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
  const { executeAction } = usePipelineActions(
    pipeline ?? ({ pipeline_id: '', status: 'stopped' } as Pipeline),
  )

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

  const saveConnectionData = async (values: KafkaConnectionFormType) => {
    const { authMethod, securityProtocol, bootstrapServers } = values

    // If in standalone mode (editing existing pipeline), check if topics have changed
    let shouldInvalidateDependents = false

    if (standalone && toggleEditMode) {
      // Phase 2: Smart invalidation - check if available topics have changed
      const { topicsStore: currentTopicsStore } = useStore.getState()
      const oldTopics = currentTopicsStore.availableTopics || []

      try {
        // Fetch topics from new connection
        const newTopics = await fetchTopicsForConnection(values)

        // Compare topic lists (sorted for accurate comparison)
        const oldTopicsSorted = [...oldTopics].sort()
        const newTopicsSorted = [...newTopics].sort()

        const topicsChanged = JSON.stringify(oldTopicsSorted) !== JSON.stringify(newTopicsSorted)

        if (topicsChanged) {
          shouldInvalidateDependents = true
        }
      } catch (error) {
        // If we can't fetch topics (connection issue), be conservative and invalidate
        shouldInvalidateDependents = true
      }
    }

    // Set full connection in store after successful test so UI and API clients use latest values.
    setKafkaConnection({
      ...values,
      bootstrapServers: values.bootstrapServers,
      isConnected: true,
    })

    setKafkaAuthMethod(authMethod)
    setKafkaSecurityProtocol(securityProtocol)
    setKafkaBootstrapServers(bootstrapServers)

    if (values.authMethod === AUTH_OPTIONS['NO_AUTH'].name && 'noAuth' in values && values.noAuth) {
      setKafkaNoAuth(values.noAuth)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/PLAIN'].name && 'saslPlain' in values && values.saslPlain) {
      setKafkaSaslPlain(values.saslPlain)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/JAAS'].name && 'saslJaas' in values && values.saslJaas) {
      setKafkaSaslJaas(values.saslJaas)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/GSSAPI'].name && 'saslGssapi' in values && values.saslGssapi) {
      setKafkaSaslGssapi(values.saslGssapi)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/OAUTHBEARER'].name && 'saslOauthbearer' in values && values.saslOauthbearer) {
      setKafkaSaslOauthbearer(values.saslOauthbearer)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name && 'saslScram256' in values && values.saslScram256) {
      setKafkaSaslScram256(values.saslScram256)
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name && 'saslScram512' in values && values.saslScram512) {
      setKafkaSaslScram512(values.saslScram512)
    }

    if (values.authMethod === AUTH_OPTIONS['Delegation tokens'].name && 'delegationTokens' in values && values.delegationTokens) {
      setKafkaDelegationTokens(values.delegationTokens)
    }

    // If in standalone mode (editing existing pipeline), mark configuration as dirty
    // This indicates changes need to be sent to backend when user clicks Resume
    if (standalone && toggleEditMode) {
      coreStore.markAsDirty()

      // Invalidate dependent sections only if topics have changed (Phase 2: Smart Invalidation)
      if (shouldInvalidateDependents) {
        const { topicsStore, joinStore, deduplicationStore, clickhouseDestinationStore } = useStore.getState()

        topicsStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
        joinStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
        deduplicationStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
        clickhouseDestinationStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
      }
    }

    // Proceed to next step or close standalone component
    if (!standalone && onCompleteStep) {
      onCompleteStep(StepKeys.KAFKA_CONNECTION as StepKeys)
    } else if (standalone && onCompleteStandaloneEditing) {
      onCompleteStandaloneEditing()
    }
  }

  // Helper function to fetch topics from a Kafka connection
  const fetchTopicsForConnection = async (connectionValues: KafkaConnectionFormType): Promise<string[]> => {
    const requestBody = connectionFormToRequestBody(connectionValues)

    const response = await fetch('/ui-api/kafka/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    if (data.success && data.topics) {
      return data.topics
    } else {
      throw new Error(data.error || 'Failed to fetch topics')
    }
  }

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
