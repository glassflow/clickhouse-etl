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

export function KafkaConnectionContainer({
  steps,
  onCompleteStep,
  validate,
  readOnly = false,
  toggleEditMode,
  standalone,
  onCompleteStandaloneEditing,
  pipelineActionState,
  pipeline,
}: {
  steps: any
  onCompleteStep?: (step: StepKeys) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: (apiConfig?: any) => void
  onCompleteStandaloneEditing?: () => void
  pipelineActionState?: any
  pipeline?: any
}) {
  const [clearErrorMessage, setClearErrorMessage] = useState(false)
  const { kafkaStore, topicsStore, coreStore } = useStore()
  const { operationsSelected } = coreStore
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

  // Use the centralized pipeline actions hook
  const { executeAction } = usePipelineActions(pipeline)

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
    if (operationsSelected?.operation) {
      analytics.page.setupKafkaConnection({})
    }
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
      // setKafkaSkipAuth(true)
      setKafkaNoAuth({
        // @ts-expect-error - FIXME: fix this later
        ...values.noAuth,
      })
    } else {
      // setKafkaSkipAuth(false)
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
    // Build request body similar to how it's done in useKafkaConnection
    const requestBody: any = {
      servers: connectionValues.bootstrapServers,
      securityProtocol: connectionValues.securityProtocol,
      authMethod: connectionValues.authMethod,
    }

    // Add authentication details based on the auth method
    switch (connectionValues.authMethod) {
      case 'NO_AUTH':
        if (connectionValues.noAuth.truststore?.certificates) {
          requestBody.certificate = connectionValues.noAuth.truststore.certificates
        }
        break

      case 'SASL/PLAIN':
        requestBody.username = connectionValues.saslPlain.username
        requestBody.password = connectionValues.saslPlain.password
        requestBody.consumerGroup = connectionValues.saslPlain.consumerGroup
        if (connectionValues.saslPlain.truststore?.certificates) {
          requestBody.certificate = connectionValues.saslPlain.truststore.certificates
        }
        break

      case 'SASL/JAAS':
        requestBody.jaasConfig = connectionValues.saslJaas.jaasConfig
        break

      case 'SASL/GSSAPI':
        requestBody.kerberosPrincipal = connectionValues.saslGssapi.kerberosPrincipal
        requestBody.kerberosKeytab = connectionValues.saslGssapi.kerberosKeytab
        requestBody.kerberosRealm = connectionValues.saslGssapi.kerberosRealm
        requestBody.kdc = connectionValues.saslGssapi.kdc
        requestBody.serviceName = connectionValues.saslGssapi.serviceName
        requestBody.krb5Config = connectionValues.saslGssapi.krb5Config
        if (connectionValues.saslGssapi.truststore?.certificates) {
          requestBody.certificate = connectionValues.saslGssapi.truststore.certificates
        }
        break

      case 'SASL/OAUTHBEARER':
        requestBody.oauthBearerToken = connectionValues.saslOauthbearer.oauthBearerToken
        break

      case 'SASL/SCRAM-256':
      case 'SASL/SCRAM-512':
        const scramValues =
          connectionValues.authMethod === 'SASL/SCRAM-256'
            ? connectionValues.saslScram256
            : connectionValues.saslScram512
        requestBody.username = scramValues.username
        requestBody.password = scramValues.password
        requestBody.consumerGroup = scramValues.consumerGroup
        if (scramValues.truststore?.certificates) {
          requestBody.certificate = scramValues.truststore.certificates
        }
        break

      case 'AWS_MSK_IAM':
        requestBody.awsAccessKey = connectionValues.awsIam.awsAccessKey
        requestBody.awsAccessKeySecret = connectionValues.awsIam.awsAccessKeySecret
        requestBody.awsRegion = connectionValues.awsIam.awsRegion
        break

      case 'Delegation tokens':
        requestBody.delegationToken = connectionValues.delegationTokens.delegationToken
        break

      case 'SASL/LDAP':
        requestBody.ldapServerUrl = connectionValues.ldap.ldapServerUrl
        requestBody.ldapServerPort = connectionValues.ldap.ldapServerPort
        requestBody.ldapBindDn = connectionValues.ldap.ldapBindDn
        requestBody.ldapBindPassword = connectionValues.ldap.ldapBindPassword
        requestBody.ldapUserSearchFilter = connectionValues.ldap.ldapUserSearchFilter
        requestBody.ldapBaseDn = connectionValues.ldap.ldapBaseDn
        break

      case 'mTLS':
        requestBody.clientCert = connectionValues.mtls.clientCert
        requestBody.clientKey = connectionValues.mtls.clientKey
        requestBody.password = connectionValues.mtls.password
        break
    }

    // Fetch topics from the Kafka connection
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
