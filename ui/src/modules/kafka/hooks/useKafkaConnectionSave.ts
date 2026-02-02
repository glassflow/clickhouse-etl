import { useCallback } from 'react'
import { useStore } from '@/src/store'
import { StepKeys, AUTH_OPTIONS } from '@/src/config/constants'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { fetchTopicsForConnection } from '@/src/modules/kafka/utils/fetchTopicsForConnection'

export interface UseKafkaConnectionSaveOptions {
  standalone?: boolean
  toggleEditMode?: (apiConfig?: unknown) => void
  onCompleteStep?: (step: StepKeys) => void
  onCompleteStandaloneEditing?: () => void
}

export function useKafkaConnectionSave(options: UseKafkaConnectionSaveOptions) {
  const { standalone = false, toggleEditMode, onCompleteStep, onCompleteStandaloneEditing } = options

  const { kafkaStore, topicsStore, coreStore } = useStore()
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
  } = kafkaStore

  const saveConnectionData = useCallback(
    async (values: KafkaConnectionFormType) => {
      const { authMethod, securityProtocol, bootstrapServers } = values

      let shouldInvalidateDependents = false

      if (standalone && toggleEditMode) {
        const { topicsStore: currentTopicsStore } = useStore.getState()
        const oldTopics = currentTopicsStore.availableTopics || []

        try {
          const newTopics = await fetchTopicsForConnection(values)
          const oldTopicsSorted = [...oldTopics].sort()
          const newTopicsSorted = [...newTopics].sort()
          const topicsChanged = JSON.stringify(oldTopicsSorted) !== JSON.stringify(newTopicsSorted)
          if (topicsChanged) {
            shouldInvalidateDependents = true
          }
        } catch {
          shouldInvalidateDependents = true
        }
      }

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
      if (
        values.authMethod === AUTH_OPTIONS['SASL/OAUTHBEARER'].name &&
        'saslOauthbearer' in values &&
        values.saslOauthbearer
      ) {
        setKafkaSaslOauthbearer(values.saslOauthbearer)
      }
      if (
        values.authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name &&
        'saslScram256' in values &&
        values.saslScram256
      ) {
        setKafkaSaslScram256(values.saslScram256)
      }
      if (
        values.authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name &&
        'saslScram512' in values &&
        values.saslScram512
      ) {
        setKafkaSaslScram512(values.saslScram512)
      }
      if (
        values.authMethod === AUTH_OPTIONS['Delegation tokens'].name &&
        'delegationTokens' in values &&
        values.delegationTokens
      ) {
        setKafkaDelegationTokens(values.delegationTokens)
      }

      if (standalone && toggleEditMode) {
        coreStore.markAsDirty()
        if (shouldInvalidateDependents) {
          const { topicsStore: ts, joinStore, deduplicationStore, clickhouseDestinationStore } = useStore.getState()
          ts.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
          joinStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
          deduplicationStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
          clickhouseDestinationStore.markAsInvalidated(StepKeys.KAFKA_CONNECTION)
        }
      }

      if (!standalone && onCompleteStep) {
        onCompleteStep(StepKeys.KAFKA_CONNECTION as StepKeys)
      } else if (standalone && onCompleteStandaloneEditing) {
        onCompleteStandaloneEditing()
      }
    },
    [
      standalone,
      toggleEditMode,
      onCompleteStep,
      onCompleteStandaloneEditing,
      setKafkaConnection,
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
      coreStore,
    ],
  )

  return { saveConnectionData }
}
