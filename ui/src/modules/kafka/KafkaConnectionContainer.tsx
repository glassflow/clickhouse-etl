'use client'

import { KafkaConnectionFormManager } from '@/src/modules/kafka/components/KafkaConnectionFormManager'
import { use, useEffect, useState, useRef } from 'react'
import { StepKeys, AUTH_OPTIONS } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { useKafkaConnection } from '@/src/hooks/useKafkaConnection'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import ActionStatusMessage from '@/src/components/shared/ActionStatusMessage'
import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaFormDefaultValues } from '@/src/config/kafka-connection-form-config'

export function KafkaConnectionContainer({
  steps,
  onCompleteStep,
  validate,
  readOnly = false,
  toggleEditMode,
  standalone,
}: {
  steps: any
  onCompleteStep?: (step: StepKeys) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
}) {
  const [clearErrorMessage, setClearErrorMessage] = useState(false)
  const { kafkaStore, topicsStore, configStore } = useStore()
  const { operationsSelected } = configStore
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
    setKafkaSkipAuth,
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

  // Prepare initial values by merging defaults with store values
  const initialValues = {
    ...KafkaFormDefaultValues,
    authMethod: (authMethod || KafkaFormDefaultValues.authMethod) as KafkaConnectionFormType['authMethod'],
    securityProtocol: securityProtocol || KafkaFormDefaultValues.securityProtocol,
    bootstrapServers: bootstrapServers || KafkaFormDefaultValues.bootstrapServers,
    saslPlain: saslPlain || KafkaFormDefaultValues.saslPlain,
    noAuth: noAuth || KafkaFormDefaultValues.noAuth,
    // saslJaas: saslJaas || KafkaFormDefaultValues.saslJaas,
    // saslGssapi: saslGssapi || KafkaFormDefaultValues.saslGssapi,
    // saslOauthbearer: saslOauthbearer || KafkaFormDefaultValues.saslOauthbearer,
    saslScram256: saslScram256 || KafkaFormDefaultValues.saslScram256,
    saslScram512: saslScram512 || KafkaFormDefaultValues.saslScram512,
    // delegationTokens: delegationTokens || KafkaFormDefaultValues.delegationToken,
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
    analytics.page.setupKafkaConnection({})
  }, [operationsSelected?.operation, analytics.page])

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

  const saveConnectionData = (values: KafkaConnectionFormType) => {
    const { authMethod, securityProtocol, bootstrapServers } = values
    // FIXME: this is not the right place to set the connection - check does it have negative side effects
    setKafkaConnection({
      ...values,
      bootstrapServers: values.bootstrapServers,
      isConnected: true,
    })

    setKafkaAuthMethod(authMethod)
    setKafkaSecurityProtocol(securityProtocol)
    setKafkaBootstrapServers(bootstrapServers)

    if (authMethod === AUTH_OPTIONS['NO_AUTH'].name) {
      setKafkaSkipAuth(true)
      setKafkaNoAuth({
        // @ts-expect-error - FIXME: fix this later
        ...values.noAuth,
      })
    } else {
      setKafkaSkipAuth(false)
      setKafkaNoAuth({
        certificate: '',
      })
    }

    // Set the appropriate auth form based on auth method
    if (values.authMethod === AUTH_OPTIONS['SASL/PLAIN'].name) {
      setKafkaSaslPlain({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslPlain,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/JAAS'].name) {
      setKafkaSaslJaas({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslJaas,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/GSSAPI'].name) {
      setKafkaSaslGssapi({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslGssapi,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/OAUTHBEARER'].name) {
      setKafkaSaslOauthbearer({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslOauthbearer,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name) {
      setKafkaSaslScram256({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslScram256,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name) {
      setKafkaSaslScram512({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslScram512,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['Delegation tokens'].name) {
      setKafkaDelegationTokens({
        // @ts-expect-error - FIXME: fix this later
        ...values.delegationTokens,
      })
    }

    onCompleteStep?.(StepKeys.KAFKA_CONNECTION as StepKeys)
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
    }
  }

  const handleDiscardConnectionChange = () => {
    setClearErrorMessage(true)
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
      />
      {connectionResult && !clearErrorMessage && (
        <ActionStatusMessage message={connectionResult.message} success={connectionResult.success} />
      )}
    </>
  )
}
