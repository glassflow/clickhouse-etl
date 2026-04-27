import { describe, it, expect, vi } from 'vitest'
import { KafkaSourceAdapter } from './adapter'
import type { AdapterDispatch, SourceAdapterStoreState } from '@/src/types/adapters'

describe('KafkaSourceAdapter', () => {
  const adapter = new KafkaSourceAdapter()

  describe('type', () => {
    it('has type "kafka"', () => {
      expect(adapter.type).toBe('kafka')
    })
  })

  describe('getTopicStepKeys', () => {
    it('returns kafka-relevant step keys', () => {
      const keys = adapter.getTopicStepKeys()
      expect(keys).toContain('kafka-connection')
      expect(keys).toContain('topic-selection-1')
      expect(keys).toContain('kafka-type-verification')
    })
  })

  // ── toWireSource fixtures ───────────────────────────────────────────────────

  function makeStore(overrides: Partial<SourceAdapterStoreState> = {}): SourceAdapterStoreState {
    return {
      kafkaStore: {
        authMethod: 'NO_AUTH',
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'broker1:9092, broker2:9092',
        noAuth: { truststore: { certificates: '', skipTlsVerification: false } },
      },
      topicsStore: {
        selectedTopics: [
          {
            name: 'my-topic',
            initialOffset: 'latest',
            replicas: 1,
            schema: { fields: [{ name: 'id', type: 'string', userType: 'string' }] },
            selectedEvent: { event: { id: '123', amount: 10 } },
          },
        ],
      },
      deduplicationStore: {
        getDeduplication: () => null,
      },
      coreStore: { sourceType: 'kafka' },
      otlpStore: null,
      ...overrides,
    }
  }

  describe('toWireSource — NO_AUTH', () => {
    it('produces kafka source with brokers list', () => {
      const result = adapter.toWireSource(makeStore())
      const src = result.source as any

      expect(src.type).toBe('kafka')
      expect(src.provider).toBe('custom')
      expect(src.connection_params.brokers).toEqual(['broker1:9092', 'broker2:9092'])
      expect(src.connection_params.mechanism).toBe('NO_AUTH')
      expect(src.connection_params.protocol).toBe('PLAINTEXT')
    })

    it('supportsJoin is false for single topic', () => {
      expect(adapter.toWireSource(makeStore()).supportsJoin).toBe(false)
    })

    it('supportsSingleTopicFeatures is true for single topic', () => {
      expect(adapter.toWireSource(makeStore()).supportsSingleTopicFeatures).toBe(true)
    })

    it('supportsJoin is true for two topics', () => {
      const store = makeStore({
        topicsStore: {
          selectedTopics: [
            { name: 'topic-a', initialOffset: 'latest', replicas: 1, schema: { fields: [] }, selectedEvent: {} },
            { name: 'topic-b', initialOffset: 'latest', replicas: 1, schema: { fields: [] }, selectedEvent: {} },
          ],
        },
      })
      expect(adapter.toWireSource(store).supportsJoin).toBe(true)
    })

    it('supportsSingleTopicFeatures is false for two topics', () => {
      const store = makeStore({
        topicsStore: {
          selectedTopics: [
            { name: 'topic-a', initialOffset: 'latest', replicas: 1, schema: { fields: [] }, selectedEvent: {} },
            { name: 'topic-b', initialOffset: 'latest', replicas: 1, schema: { fields: [] }, selectedEvent: {} },
          ],
        },
      })
      expect(adapter.toWireSource(store).supportsSingleTopicFeatures).toBe(false)
    })
  })

  describe('toWireSource — SASL/PLAIN', () => {
    function saslPlainStore(): SourceAdapterStoreState {
      return makeStore({
        kafkaStore: {
          authMethod: 'SASL/PLAIN',
          securityProtocol: 'SASL_PLAINTEXT',
          bootstrapServers: 'broker:9092',
          saslPlain: {
            username: 'user1',
            password: 'secret',
            truststore: { certificates: '', skipTlsVerification: false },
          },
        },
      })
    }

    it('sets mechanism to PLAIN', () => {
      const src = adapter.toWireSource(saslPlainStore()).source as any
      expect(src.connection_params.mechanism).toBe('PLAIN')
    })

    it('sets username and password', () => {
      const src = adapter.toWireSource(saslPlainStore()).source as any
      expect(src.connection_params.username).toBe('user1')
      expect(src.connection_params.password).toBe('secret')
    })

    it('does NOT include root_ca when not TLS', () => {
      const src = adapter.toWireSource(saslPlainStore()).source as any
      expect(src.connection_params.root_ca).toBeUndefined()
    })

    it('includes root_ca when TLS enabled and cert present', () => {
      const store = makeStore({
        kafkaStore: {
          authMethod: 'SASL/PLAIN',
          securityProtocol: 'SASL_SSL',
          bootstrapServers: 'broker:9093',
          saslPlain: {
            username: 'user1',
            password: 'secret',
            truststore: {
              certificates: 'my-cert',
              skipTlsVerification: false,
            },
          },
        },
      })
      const src = adapter.toWireSource(store).source as any
      expect(src.connection_params.root_ca).toBeDefined()
      // Should be base64 encoded
      expect(typeof src.connection_params.root_ca).toBe('string')
    })
  })

  describe('toWireSource — SASL/SCRAM-256', () => {
    function scramStore(): SourceAdapterStoreState {
      return makeStore({
        kafkaStore: {
          authMethod: 'SASL/SCRAM-256',
          securityProtocol: 'SASL_PLAINTEXT',
          bootstrapServers: 'broker:9092',
          saslScram256: {
            username: 'scram-user',
            password: 'scram-pass',
            truststore: { certificates: '', skipTlsVerification: false },
          },
        },
      })
    }

    it('sets mechanism to SCRAM-SHA-256', () => {
      const src = adapter.toWireSource(scramStore()).source as any
      expect(src.connection_params.mechanism).toBe('SCRAM-SHA-256')
    })

    it('sets username and password from saslScram256', () => {
      const src = adapter.toWireSource(scramStore()).source as any
      expect(src.connection_params.username).toBe('scram-user')
      expect(src.connection_params.password).toBe('scram-pass')
    })
  })

  describe('toWireSource — SASL/SCRAM-512', () => {
    function scram512Store(): SourceAdapterStoreState {
      return makeStore({
        kafkaStore: {
          authMethod: 'SASL/SCRAM-512',
          securityProtocol: 'SASL_PLAINTEXT',
          bootstrapServers: 'broker:9092',
          saslScram512: {
            username: 'scram512-user',
            password: 'scram512-pass',
            truststore: { certificates: '', skipTlsVerification: false },
          },
        },
      })
    }

    it('sets mechanism to SCRAM-SHA-512', () => {
      const src = adapter.toWireSource(scram512Store()).source as any
      expect(src.connection_params.mechanism).toBe('SCRAM-SHA-512')
    })

    it('sets username and password from saslScram512', () => {
      const src = adapter.toWireSource(scram512Store()).source as any
      expect(src.connection_params.username).toBe('scram512-user')
      expect(src.connection_params.password).toBe('scram512-pass')
    })

    it('does NOT use saslScram256 fields', () => {
      const store = makeStore({
        kafkaStore: {
          authMethod: 'SASL/SCRAM-512',
          securityProtocol: 'SASL_PLAINTEXT',
          bootstrapServers: 'broker:9092',
          saslScram256: { username: 'wrong-user', password: 'wrong-pass', truststore: { certificates: '', skipTlsVerification: false } },
          saslScram512: { username: 'correct-user', password: 'correct-pass', truststore: { certificates: '', skipTlsVerification: false } },
        },
      })
      const src = adapter.toWireSource(store).source as any
      expect(src.connection_params.username).toBe('correct-user')
    })
  })

  describe('toWireSource — mTLS', () => {
    function mtlsStore(overrides?: { clientCert?: string; clientKey?: string; password?: string }): SourceAdapterStoreState {
      return makeStore({
        kafkaStore: {
          authMethod: 'mTLS',
          securityProtocol: 'SSL',
          bootstrapServers: 'broker:9093',
          mtls: {
            clientCert: overrides?.clientCert ?? 'BEGIN CERTIFICATE',
            clientKey: overrides?.clientKey ?? 'BEGIN PRIVATE KEY',
            password: overrides?.password ?? 'mtls-pwd',
          },
        },
      })
    }

    it('sets mechanism to MTLS', () => {
      const src = adapter.toWireSource(mtlsStore()).source as any
      expect(src.connection_params.mechanism).toBe('MTLS')
    })

    it('encodes client_cert as base64', () => {
      const src = adapter.toWireSource(mtlsStore({ clientCert: 'my-cert' })).source as any
      expect(src.connection_params.client_cert).toBe(Buffer.from('my-cert').toString('base64'))
    })

    it('encodes client_key as base64', () => {
      const src = adapter.toWireSource(mtlsStore({ clientKey: 'my-key' })).source as any
      expect(src.connection_params.client_key).toBe(Buffer.from('my-key').toString('base64'))
    })

    it('does not include username or password in connection_params', () => {
      const src = adapter.toWireSource(mtlsStore()).source as any
      expect(src.connection_params.username).toBeUndefined()
      expect(src.connection_params.password).toBeUndefined()
    })
  })

  describe('toWireSource — SASL/GSSAPI', () => {
    function gssapiStore(): SourceAdapterStoreState {
      return makeStore({
        kafkaStore: {
          authMethod: 'SASL/GSSAPI',
          securityProtocol: 'SASL_PLAINTEXT',
          bootstrapServers: 'broker:9092',
          saslGssapi: {
            kerberosPrincipal: 'kafka/broker@REALM',
            serviceName: 'kafka',
            kerberosRealm: 'EXAMPLE.COM',
            kerberosKeytab: '/etc/krb5.keytab',
            krb5Config: '/etc/krb5.conf',
            truststore: { certificates: '', skipTlsVerification: false },
          },
        },
      })
    }

    it('sets mechanism to GSSAPI', () => {
      const src = adapter.toWireSource(gssapiStore()).source as any
      expect(src.connection_params.mechanism).toBe('GSSAPI')
    })

    it('maps kerberosPrincipal to username', () => {
      const src = adapter.toWireSource(gssapiStore()).source as any
      expect(src.connection_params.username).toBe('kafka/broker@REALM')
    })

    it('maps serviceName to kerberos_service_name', () => {
      const src = adapter.toWireSource(gssapiStore()).source as any
      expect(src.connection_params.kerberos_service_name).toBe('kafka')
    })
  })

  describe('toWireSource — topics and deduplication', () => {
    it('includes topic name and schema fields', () => {
      const src = adapter.toWireSource(makeStore()).source as any
      const topic = src.topics[0]
      expect(topic.name).toBe('my-topic')
      expect(topic.schema.fields).toEqual([{ name: 'id', type: 'string' }])
    })

    it('includes deduplication config when enabled', () => {
      const store = makeStore({
        deduplicationStore: {
          getDeduplication: () => ({
            enabled: true,
            key: 'id',
            keyType: 'string',
            window: 1,
            unit: 'hours',
          }),
        },
      })
      const src = adapter.toWireSource(store).source as any
      const dedup = src.topics[0].deduplication
      expect(dedup.enabled).toBe(true)
      expect(dedup.id_field).toBe('id')
      expect(dedup.time_window).toBe('1h')
    })

    it('sets deduplication disabled when not configured', () => {
      const src = adapter.toWireSource(makeStore()).source as any
      expect(src.topics[0].deduplication.enabled).toBe(false)
    })
  })

  describe('fromWireSource', () => {
    it('calls hydrateKafkaConnection with the wire config', () => {
      const hydrateKafkaConnection = vi.fn()
      const dispatch: AdapterDispatch = { hydrateKafkaConnection }
      const wire = { sources: [{ type: 'kafka' }] }

      adapter.fromWireSource(wire, dispatch)

      expect(hydrateKafkaConnection).toHaveBeenCalledWith(wire)
    })

    it('calls hydrateTopics with the wire config', () => {
      const hydrateTopics = vi.fn().mockResolvedValue(undefined)
      const dispatch: AdapterDispatch = { hydrateTopics }
      const wire = { sources: [{ type: 'kafka' }] }

      adapter.fromWireSource(wire, dispatch)

      expect(hydrateTopics).toHaveBeenCalledWith(wire)
    })

    it('does not throw when no callbacks are provided', () => {
      expect(() => adapter.fromWireSource({}, {})).not.toThrow()
    })
  })

  describe('fromWireSource — roundtrip', () => {
    it('calls both hydration callbacks in sequence', async () => {
      const calls: string[] = []
      const hydrateKafkaConnection = vi.fn(() => { calls.push('connection') })
      const hydrateTopics = vi.fn(async () => { calls.push('topics') })

      await adapter.fromWireSource({}, { hydrateKafkaConnection, hydrateTopics })

      expect(calls).toEqual(['connection', 'topics'])
    })
  })
})
