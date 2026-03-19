import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KafkaGatewayClient } from '../kafka-gateway-client'
import { KafkaConnectionError } from '../kafka-client-interface'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('KafkaGatewayClient', () => {
  const baseConfig = {
    brokers: ['kafka1.example.com:9092', 'kafka2.example.com:9092'],
    securityProtocol: 'SASL_SSL',
    authMethod: 'SASL/GSSAPI',
    kerberosPrincipal: 'kafka/kafka@EXAMPLE.COM',
    kerberosKeytab: 'YmFzZTY0a2V5dGFi', // base64 encoded "base64keytab"
    krb5Config: '[libdefaults]\ndefault_realm = EXAMPLE.COM',
    serviceName: 'kafka',
  }

  let client: KafkaGatewayClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    client = new KafkaGatewayClient(baseConfig)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('creates a client with the provided config', () => {
      const client = new KafkaGatewayClient(baseConfig)
      expect(client).toBeInstanceOf(KafkaGatewayClient)
    })
  })

  describe('buildGatewayRequest (via testConnection)', () => {
    describe('keytab processing', () => {
      it('strips data URL prefix from keytab', async () => {
        const configWithDataUrl = {
          ...baseConfig,
          kerberosKeytab: 'data:application/octet-stream;base64,YmFzZTY0a2V5dGFi',
        }
        const clientWithDataUrl = new KafkaGatewayClient(configWithDataUrl)

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await clientWithDataUrl.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.keytab).toBe('YmFzZTY0a2V5dGFi')
        expect(requestBody.keytab).not.toContain('data:')
      })

      it('keeps keytab as-is if already base64', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await client.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.keytab).toBe('YmFzZTY0a2V5dGFi')
      })
    })

    describe('krb5Config processing', () => {
      it('encodes plain text krb5Config as base64', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await client.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        // Plain text should be encoded to base64
        const decoded = Buffer.from(requestBody.krb5Conf, 'base64').toString('utf-8')
        expect(decoded).toBe('[libdefaults]\ndefault_realm = EXAMPLE.COM')
      })

      it('extracts base64 from data URL', async () => {
        const configWithDataUrl = {
          ...baseConfig,
          krb5Config: 'data:text/plain;base64,W2xpYmRlZmF1bHRzXQpkZWZhdWx0X3JlYWxtID0gRVhBTVBMRS5DT00=',
        }
        const clientWithDataUrl = new KafkaGatewayClient(configWithDataUrl)

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await clientWithDataUrl.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.krb5Conf).toBe('W2xpYmRlZmF1bHRzXQpkZWZhdWx0X3JlYWxtID0gRVhBTVBMRS5DT00=')
      })
    })

    describe('CA certificate processing', () => {
      it('encodes PEM certificate as base64', async () => {
        const configWithCert = {
          ...baseConfig,
          certificate: '-----BEGIN CERTIFICATE-----\nMIIBkTCC...\n-----END CERTIFICATE-----',
        }
        const clientWithCert = new KafkaGatewayClient(configWithCert)

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await clientWithCert.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.caCertificate).toBeDefined()
        const decoded = Buffer.from(requestBody.caCertificate, 'base64').toString('utf-8')
        expect(decoded).toContain('BEGIN CERTIFICATE')
      })

      it('uses truststore certificates if available', async () => {
        const configWithTruststore = {
          ...baseConfig,
          truststore: {
            certificates: ['cert1', 'cert2'],
          },
        }
        const clientWithTruststore = new KafkaGatewayClient(configWithTruststore)

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await clientWithTruststore.testConnection()

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.caCertificate).toBeDefined()
        const decoded = Buffer.from(requestBody.caCertificate, 'base64').toString('utf-8')
        expect(decoded).toBe('cert1\ncert2')
      })
    })

    describe('validation', () => {
      it('returns false when kerberosPrincipal is missing (testConnection catches errors)', async () => {
        const invalidConfig = {
          ...baseConfig,
          kerberosPrincipal: undefined,
        }
        const invalidClient = new KafkaGatewayClient(invalidConfig as any)

        // testConnection catches errors and returns false
        const result = await invalidClient.testConnection()
        expect(result).toBe(false)
      })

      it('returns false when kerberosKeytab is missing (testConnection catches errors)', async () => {
        const invalidConfig = {
          ...baseConfig,
          kerberosKeytab: undefined,
        }
        const invalidClient = new KafkaGatewayClient(invalidConfig as any)

        const result = await invalidClient.testConnection()
        expect(result).toBe(false)
      })

      it('returns false when krb5Config is missing (testConnection catches errors)', async () => {
        const invalidConfig = {
          ...baseConfig,
          krb5Config: undefined,
        }
        const invalidClient = new KafkaGatewayClient(invalidConfig as any)

        const result = await invalidClient.testConnection()
        expect(result).toBe(false)
      })

      it('throws error from listTopics when kerberosPrincipal is missing', async () => {
        const invalidConfig = {
          ...baseConfig,
          kerberosPrincipal: undefined,
        }
        const invalidClient = new KafkaGatewayClient(invalidConfig as any)

        await expect(invalidClient.listTopics()).rejects.toThrow(
          'SASL/GSSAPI configuration is incomplete',
        )
      })
    })
  })

  describe('testConnection', () => {
    it('returns true on successful connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await client.testConnection()
      expect(result).toBe(true)
    })

    it('returns false on connection failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Connection refused',
          }),
      })

      const result = await client.testConnection()
      expect(result).toBe(false)
    })

    it('returns false when aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      const result = await client.testConnection(abortController.signal)
      expect(result).toBe(false)
    })

    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      await client.testConnection()

      expect(mockFetch.mock.calls[0][0]).toContain('/kafka/test-connection')
    })
  })

  describe('listTopics', () => {
    it('returns topics array on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topics: ['topic1', 'topic2', 'topic3'],
          }),
      })

      const topics = await client.listTopics()
      expect(topics).toEqual(['topic1', 'topic2', 'topic3'])
    })

    it('throws error when no topics returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topics: undefined,
          }),
      })

      await expect(client.listTopics()).rejects.toThrow('Gateway returned no topics')
    })

    it('throws error when aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      await expect(client.listTopics(abortController.signal)).rejects.toThrow('Operation aborted')
    })
  })

  describe('getTopicDetails', () => {
    it('returns topic details array on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topicDetails: [
              { name: 'topic1', partitionCount: 3 },
              { name: 'topic2', partitionCount: 6 },
            ],
          }),
      })

      const details = await client.getTopicDetails()
      expect(details).toEqual([
        { name: 'topic1', partitionCount: 3 },
        { name: 'topic2', partitionCount: 6 },
      ])
    })

    it('throws error when no topic details returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topicDetails: undefined,
          }),
      })

      await expect(client.getTopicDetails()).rejects.toThrow('Gateway returned no topic details')
    })
  })

  describe('fetchSampleEvent', () => {
    it('returns parsed JSON event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            event: {
              topic: 'test-topic',
              partition: 0,
              offset: 100,
              key: 'key1',
              value: '{"id": 123, "name": "test"}',
              timestamp: 1234567890,
            },
            hasMoreEvents: true,
            isAtLatest: false,
            isAtEarliest: false,
            isEmptyTopic: false,
          }),
      })

      const event = await client.fetchSampleEvent('test-topic')
      expect(event).toEqual({ id: 123, name: 'test' })
    })

    it('returns raw value when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            event: {
              topic: 'test-topic',
              partition: 0,
              offset: 100,
              value: 'not valid json',
              timestamp: 1234567890,
            },
            hasMoreEvents: false,
            isAtLatest: true,
            isAtEarliest: false,
            isEmptyTopic: false,
          }),
      })

      const event = await client.fetchSampleEvent('test-topic')
      expect(event).toBe('not valid json')
    })

    it('returns null when no event found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            event: undefined,
            hasMoreEvents: false,
            isAtLatest: true,
            isAtEarliest: true,
            isEmptyTopic: true,
          }),
      })

      const event = await client.fetchSampleEvent('test-topic')
      expect(event).toBeNull()
    })

    it('passes partition option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            event: { value: '{}' },
            hasMoreEvents: true,
            isAtLatest: false,
            isAtEarliest: false,
            isEmptyTopic: false,
          }),
      })

      await client.fetchSampleEvent('test-topic', 'JSON', false, null, { partition: 5 })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.partition).toBe(5)
    })

    it('throws when aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      await expect(
        client.fetchSampleEvent('test-topic', 'JSON', false, null, {
          abortSignal: abortController.signal,
        }),
      ).rejects.toThrow('Operation aborted')
    })
  })

  describe('error handling', () => {
    it('throws KafkaConnectionError on gateway error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Authentication failed',
          }),
      })

      // Gateway error responses are not retried
      await expect(client.listTopics()).rejects.toThrow('Authentication failed')
    })

    it('throws KafkaConnectionError on HTTP error', async () => {
      // HTTP errors are retryable, so we need to mock multiple responses
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const topicsPromise = client.listTopics()
      await vi.runAllTimersAsync()

      await expect(topicsPromise).rejects.toThrow('Gateway returned 500')
    })

    it('throws KafkaConnectionError on fetch failure', async () => {
      // Network errors are retryable
      mockFetch.mockRejectedValue(new Error('Network error'))

      const topicsPromise = client.listTopics()
      await vi.runAllTimersAsync()

      await expect(topicsPromise).rejects.toThrow('Gateway communication failed')
    })

    it('throws KafkaConnectionError on timeout', async () => {
      const timeoutError = new Error('Request timed out')
      timeoutError.name = 'TimeoutError'
      mockFetch.mockRejectedValue(timeoutError)

      const topicsPromise = client.listTopics()
      await vi.runAllTimersAsync()

      await expect(topicsPromise).rejects.toThrow('timed out')
    })
  })

  describe('retry logic', () => {
    it('retries on transient failures', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, topics: ['topic1'] }),
        })

      const topicsPromise = client.listTopics()

      // Initial call happened, advance past first retry delay
      await vi.advanceTimersByTimeAsync(1000)

      const topics = await topicsPromise
      expect(topics).toEqual(['topic1'])
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('gives up after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

      const topicsPromise = client.listTopics()

      // Run all timers to completion instead of advancing manually
      await vi.runAllTimersAsync()

      await expect(topicsPromise).rejects.toThrow('Gateway communication failed')
      expect(mockFetch).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })
  })

  describe('unsupported operations', () => {
    it('throws error for send', async () => {
      await expect(client.send('topic', [])).rejects.toThrow('not supported')
    })

    it('throws error for subscribe', async () => {
      await expect(client.subscribe(['topic'])).rejects.toThrow('not supported')
    })

    it('throws error for consume', async () => {
      await expect(client.consume(() => {})).rejects.toThrow('not supported')
    })

    it('throws error for createTopic', async () => {
      await expect(client.createTopic('topic')).rejects.toThrow('not yet implemented')
    })
  })

  describe('connect and disconnect', () => {
    it('connect is a no-op', async () => {
      // Should not throw
      await client.connect()
    })

    it('disconnect is a no-op', async () => {
      // Should not throw
      await client.disconnect()
    })
  })

  describe('getTopicMetadata', () => {
    it('returns metadata for existing topic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topicDetails: [
              { name: 'topic1', partitionCount: 3 },
              { name: 'topic2', partitionCount: 6 },
            ],
          }),
      })

      const metadata = await client.getTopicMetadata('topic1')
      expect(metadata).toEqual({ name: 'topic1', partitions: 3 })
    })

    it('throws error for non-existent topic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            topicDetails: [{ name: 'topic1', partitionCount: 3 }],
          }),
      })

      await expect(client.getTopicMetadata('non-existent')).rejects.toThrow("Topic 'non-existent' not found")
    })
  })

  describe('checkHealth', () => {
    it('returns true when gateway is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })

      const isHealthy = await KafkaGatewayClient.checkHealth()
      expect(isHealthy).toBe(true)
    })

    it('returns false when gateway returns unhealthy status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'unhealthy' }),
      })

      const isHealthy = await KafkaGatewayClient.checkHealth()
      expect(isHealthy).toBe(false)
    })

    it('returns false on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const isHealthy = await KafkaGatewayClient.checkHealth()
      expect(isHealthy).toBe(false)
    })

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const isHealthy = await KafkaGatewayClient.checkHealth()
      expect(isHealthy).toBe(false)
    })
  })
})
