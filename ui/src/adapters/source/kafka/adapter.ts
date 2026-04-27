/**
 * Kafka source adapter.
 *
 * toWireSource: builds the `source` section of InternalPipelineConfig for a Kafka-backed pipeline.
 * fromWireSource: dispatches to hydrateKafkaConnection + hydrateTopics callbacks.
 */

import { StepKeys } from '@/src/config/constants'
import { SourceType } from '@/src/config/source-types'
import type {
  SourceAdapter,
  SourceAdapterStoreState,
  SourceWireResult,
  AdapterDispatch,
} from '@/src/types/adapters'

const encodeBase64 = (value: string): string | undefined =>
  value ? Buffer.from(value).toString('base64') : undefined

// Local shape for the Kafka store fields this adapter reads.
// Mirrors the fields in KafkaStore / KafkaStoreProps without importing the entire slice.
interface KafkaStoreShape {
  authMethod?: string
  securityProtocol?: string
  bootstrapServers?: string
  saslPlain?: { username?: string; password?: string; truststore?: { certificates?: string; skipTlsVerification?: boolean } }
  saslScram256?: { username?: string; password?: string; truststore?: { certificates?: string; skipTlsVerification?: boolean } }
  saslScram512?: { username?: string; password?: string; truststore?: { certificates?: string; skipTlsVerification?: boolean } }
  saslGssapi?: { kerberosPrincipal?: string; serviceName?: string; kerberosRealm?: string; kerberosKeytab?: string; krb5Config?: string; truststore?: { certificates?: string; skipTlsVerification?: boolean } }
  noAuth?: { truststore?: { certificates?: string; skipTlsVerification?: boolean } }
  mtls?: { clientCert?: string; clientKey?: string; password?: string }
}

// Local shape for the topics store as passed by callers (array of selected topics).
interface TopicsStoreShape {
  selectedTopics?: TopicShape[]
}

interface TopicShape {
  name?: string
  initialOffset?: string
  replicas?: number
  schema?: { fields?: SchemaFieldShape[] }
  selectedEvent?: { event?: Record<string, unknown> }
}

interface SchemaFieldShape {
  name?: string
  type?: string
  userType?: string
  isRemoved?: boolean
}

// Local shape for the deduplication store.
interface DeduplicationStoreShape {
  getDeduplication?: (topicIndex: number) => DeduplicationConfigShape | null | undefined
}

interface DeduplicationConfigShape {
  enabled?: boolean
  key?: string
  keyType?: string
  window?: number
  unit?: string
}

// Local shape for the core store fields this adapter reads.
interface CoreStoreShape {
  sourceType?: string
}

export class KafkaSourceAdapter implements SourceAdapter {
  readonly type = SourceType.KAFKA

  /**
   * supportsJoin depends on topic count — computed at wire time, not statically.
   * Per the interface contract, adapter-level flags return the static default;
   * the dynamic value is reflected in SourceWireResult returned by toWireSource.
   */
  get supportsJoin(): boolean {
    return false
  }

  get supportsSingleTopicFeatures(): boolean {
    return true
  }

  toWireSource(storeState: SourceAdapterStoreState): SourceWireResult {
    const kafkaStore = storeState.kafkaStore as KafkaStoreShape
    const topicsStore = storeState.topicsStore as TopicsStoreShape
    const deduplicationStore = storeState.deduplicationStore as DeduplicationStoreShape
    const _coreStore = storeState.coreStore as CoreStoreShape

    const selectedTopics: TopicShape[] = topicsStore?.selectedTopics ?? []
    const authMethod: string = kafkaStore?.authMethod ?? 'NO_AUTH'
    const securityProtocol: string = kafkaStore?.securityProtocol ?? 'PLAINTEXT'
    const isTLSEnabled = securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL'

    // Resolve skip_tls_verification from the appropriate truststore
    let skipTlsVerification = false
    if (isTLSEnabled) {
      if (authMethod === 'SASL/PLAIN') {
        skipTlsVerification = kafkaStore?.saslPlain?.truststore?.skipTlsVerification ?? false
      } else if (authMethod === 'SASL/SCRAM-256') {
        skipTlsVerification = kafkaStore?.saslScram256?.truststore?.skipTlsVerification ?? false
      } else if (authMethod === 'SASL/SCRAM-512') {
        skipTlsVerification = kafkaStore?.saslScram512?.truststore?.skipTlsVerification ?? false
      } else if (authMethod === 'SASL/GSSAPI') {
        skipTlsVerification = kafkaStore?.saslGssapi?.truststore?.skipTlsVerification ?? false
      } else if (authMethod === 'NO_AUTH') {
        skipTlsVerification = kafkaStore?.noAuth?.truststore?.skipTlsVerification ?? false
      }
    }

    // Determine wire mechanism
    const mechanism = this._resolveMechanism(authMethod)

    const connectionParams: Record<string, unknown> = {
      brokers: (kafkaStore?.bootstrapServers?.split(',') ?? []).map((b: string) => b.trim()),
      protocol: securityProtocol,
      skip_auth: authMethod === 'NO_AUTH',
      mechanism: mechanism || 'NO_AUTH',
    }

    if (isTLSEnabled) {
      connectionParams.skip_tls_verification = skipTlsVerification
    }

    // Auth-specific fields
    if (authMethod === 'SASL/PLAIN') {
      connectionParams.username = kafkaStore?.saslPlain?.username
      connectionParams.password = kafkaStore?.saslPlain?.password
      if (isTLSEnabled && kafkaStore?.saslPlain?.truststore?.certificates) {
        connectionParams.root_ca = encodeBase64(kafkaStore.saslPlain.truststore.certificates)
      }
    } else if (authMethod === 'SASL/SCRAM-256' || authMethod === 'SASL/SCRAM-512') {
      const scramConfig = authMethod === 'SASL/SCRAM-256' ? kafkaStore?.saslScram256 : kafkaStore?.saslScram512
      connectionParams.username = scramConfig?.username
      connectionParams.password = scramConfig?.password
      if (isTLSEnabled && scramConfig?.truststore?.certificates) {
        connectionParams.root_ca = encodeBase64(scramConfig.truststore.certificates)
      }
    } else if (authMethod === 'SASL/GSSAPI') {
      connectionParams.username = kafkaStore?.saslGssapi?.kerberosPrincipal
      connectionParams.kerberos_service_name = kafkaStore?.saslGssapi?.serviceName
      connectionParams.kerberos_realm = kafkaStore?.saslGssapi?.kerberosRealm
      connectionParams.kerberos_keytab = kafkaStore?.saslGssapi?.kerberosKeytab
      connectionParams.kerberos_config = kafkaStore?.saslGssapi?.krb5Config
      if (isTLSEnabled && kafkaStore?.saslGssapi?.truststore?.certificates) {
        connectionParams.root_ca = encodeBase64(kafkaStore.saslGssapi.truststore.certificates)
      }
    } else if (authMethod === 'mTLS') {
      if (kafkaStore?.mtls?.clientCert) {
        connectionParams.client_cert = encodeBase64(kafkaStore.mtls.clientCert)
      }
      if (kafkaStore?.mtls?.clientKey) {
        connectionParams.client_key = encodeBase64(kafkaStore.mtls.clientKey)
      }
    } else if (authMethod === 'NO_AUTH' && isTLSEnabled) {
      if (kafkaStore?.noAuth?.truststore?.certificates) {
        connectionParams.root_ca = encodeBase64(kafkaStore.noAuth.truststore.certificates)
      }
    }

    // Build topics config
    const topicsConfig = selectedTopics.map((topic: TopicShape, topicIndex: number) => {
      const deduplicationConfig = deduplicationStore?.getDeduplication?.(topicIndex) ?? null

      let eventData: Record<string, unknown> = {}
      if (topic.selectedEvent?.event) {
        eventData = { ...topic.selectedEvent.event }
        if ('_metadata' in eventData) delete eventData._metadata
      }

      const schemaFields =
        topic.schema?.fields && topic.schema.fields.length > 0
          ? topic.schema.fields
              .filter((f: SchemaFieldShape) => !f.isRemoved)
              .map((f: SchemaFieldShape) => ({ name: f.name, type: f.userType ?? f.type ?? 'string' }))
          : Object.keys(eventData).map((k) => ({ name: k, type: 'string' }))

      return {
        consumer_group_initial_offset: topic.initialOffset,
        name: topic.name,
        id: topic.name,
        replicas: topic.replicas,
        schema: { type: 'json', fields: schemaFields },
        deduplication:
          deduplicationConfig?.enabled && deduplicationConfig?.key
            ? {
                enabled: true,
                id_field: deduplicationConfig.key,
                id_field_type: deduplicationConfig.keyType,
                time_window: deduplicationConfig.window
                  ? `${deduplicationConfig.window}${deduplicationConfig.unit?.charAt(0) ?? 'h'}`
                  : '1h',
              }
            : { enabled: false },
      }
    })

    const topicCount = selectedTopics.length
    const supportsJoin = topicCount > 1
    const supportsSingleTopicFeatures = topicCount <= 1

    return {
      source: {
        type: 'kafka',
        provider: 'custom',
        connection_params: connectionParams,
        topics: topicsConfig,
      },
      supportsJoin,
      supportsSingleTopicFeatures,
    }
  }

  fromWireSource(wire: unknown, dispatch: AdapterDispatch): void {
    if (dispatch.hydrateKafkaConnection) {
      dispatch.hydrateKafkaConnection(wire)
    }
    if (dispatch.hydrateTopics) {
      // hydrateTopics is async but fromWireSource callers can await the returned promise
      void dispatch.hydrateTopics(wire)
    }
  }

  async fromWireSourceAsync(wire: unknown, dispatch: AdapterDispatch): Promise<void> {
    if (dispatch.hydrateKafkaConnection) {
      dispatch.hydrateKafkaConnection(wire)
    }
    if (dispatch.hydrateTopics) {
      await dispatch.hydrateTopics(wire)
    }
  }

  getTopicStepKeys(): string[] {
    return [
      StepKeys.KAFKA_CONNECTION,
      StepKeys.TOPIC_SELECTION_1,
      StepKeys.TOPIC_SELECTION_2,
      StepKeys.KAFKA_TYPE_VERIFICATION,
    ]
  }

  private _resolveMechanism(authMethod: string): string {
    switch (authMethod) {
      case 'NO_AUTH': return 'NO_AUTH'
      case 'SASL/PLAIN': return 'PLAIN'
      case 'SASL/SCRAM-256': return 'SCRAM-SHA-256'
      case 'SASL/SCRAM-512': return 'SCRAM-SHA-512'
      case 'SASL/GSSAPI': return 'GSSAPI'
      case 'SASL/OAUTHBEARER': return 'OAUTHBEARER'
      case 'SASL/JAAS': return 'JAAS'
      case 'SASL/LDAP': return 'LDAP'
      case 'mTLS': return 'MTLS'
      default: return 'NO_AUTH'
    }
  }
}
