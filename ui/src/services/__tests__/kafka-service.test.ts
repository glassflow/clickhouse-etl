import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KafkaService } from '../kafka-service'
import { IKafkaClient } from '@/src/lib/kafka-client-interface'

// Mock the kafka client factory
vi.mock('@/src/lib/kafka-client-factory', () => ({
  createKafkaClient: vi.fn(),
}))

import { createKafkaClient } from '@/src/lib/kafka-client-factory'

const mockCreateKafkaClient = createKafkaClient as ReturnType<typeof vi.fn>

function createMockKafkaClient(overrides: Partial<IKafkaClient> = {}): IKafkaClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue(undefined),
    listTopics: vi.fn().mockResolvedValue(['topic1', 'topic2']),
    getTopicMetadata: vi.fn().mockResolvedValue({ name: 'topic1', partitions: [] }),
    testConnection: vi.fn().mockResolvedValue(true),
    getTopicDetails: vi.fn().mockResolvedValue([
      { name: 'topic1', partitionCount: 3 },
      { name: 'topic2', partitionCount: 6 },
    ]),
    fetchSampleEvent: vi.fn().mockResolvedValue({
      data: 'test',
      _metadata: { offset: '100', partition: 0, topic: 'topic1' },
    }),
    ...overrides,
  }
}

describe('KafkaService', () => {
  let service: KafkaService
  let mockClient: IKafkaClient

  beforeEach(() => {
    vi.useFakeTimers()
    service = new KafkaService()
    mockClient = createMockKafkaClient()
    mockCreateKafkaClient.mockResolvedValue(mockClient)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const baseConfig = {
    brokers: ['localhost:9092'],
    authMethod: 'SASL/PLAIN',
    username: 'test',
    password: 'test',
  }

  describe('testConnection', () => {
    it('returns true on successful connection', async () => {
      const result = await service.testConnection(baseConfig)
      expect(result).toBe(true)
      expect(mockClient.testConnection).toHaveBeenCalled()
    })

    it('returns false on connection failure', async () => {
      mockClient.testConnection = vi.fn().mockResolvedValue(false)
      const result = await service.testConnection(baseConfig)
      expect(result).toBe(false)
    })

    it('returns false on timeout', async () => {
      // Simulate what happens when abort signal triggers (client would resolve after 65s, service aborts at 60s)
      mockClient.testConnection = vi.fn().mockImplementation((abortSignal?: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(true)
          }, 65000)

          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation aborted'))
            })
          }
        })
      })

      const resultPromise = service.testConnection(baseConfig)

      // Run all timers which will trigger the service's internal timeout
      await vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result).toBe(false)
    })

    it('always disconnects the client', async () => {
      await service.testConnection(baseConfig)
      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('disconnects even on error', async () => {
      mockClient.testConnection = vi.fn().mockRejectedValue(new Error('Connection failed'))

      await expect(service.testConnection(baseConfig)).rejects.toThrow('Connection failed')
      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('handles disconnect errors gracefully', async () => {
      mockClient.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect failed'))

      // Should not throw
      const result = await service.testConnection(baseConfig)
      expect(result).toBe(true)
    })
  })

  describe('getTopics', () => {
    it('returns topics array on success', async () => {
      const topics = await service.getTopics(baseConfig)
      expect(topics).toEqual(['topic1', 'topic2'])
    })

    it('throws timeout error when operation times out', async () => {
      mockClient.listTopics = vi.fn().mockImplementation((abortSignal?: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(['topic1']), 65000)

          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation aborted'))
            })
          }
        })
      })

      const topicsPromise = service.getTopics(baseConfig)

      // Run all timers which will trigger the service's internal timeout
      await vi.runAllTimersAsync()

      await expect(topicsPromise).rejects.toThrow('Operation timed out after 60 seconds')
    })

    it('passes abort signal to client', async () => {
      await service.getTopics(baseConfig)

      expect(mockClient.listTopics).toHaveBeenCalledWith(expect.any(AbortSignal))
    })

    it('always disconnects the client', async () => {
      await service.getTopics(baseConfig)
      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('re-throws non-timeout errors', async () => {
      mockClient.listTopics = vi.fn().mockRejectedValue(new Error('Kafka error'))

      await expect(service.getTopics(baseConfig)).rejects.toThrow('Kafka error')
    })
  })

  describe('getTopicDetails', () => {
    it('returns topic details on success', async () => {
      const details = await service.getTopicDetails(baseConfig)
      expect(details).toEqual([
        { name: 'topic1', partitionCount: 3 },
        { name: 'topic2', partitionCount: 6 },
      ])
    })

    it('throws error when getTopicDetails is not supported', async () => {
      mockClient.getTopicDetails = undefined

      await expect(service.getTopicDetails(baseConfig)).rejects.toThrow(
        'getTopicDetails is not supported by this Kafka client',
      )
    })

    it('throws timeout error when operation times out', async () => {
      mockClient.getTopicDetails = vi.fn().mockImplementation((abortSignal?: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve([]), 65000)

          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation aborted'))
            })
          }
        })
      })

      const detailsPromise = service.getTopicDetails(baseConfig)

      await vi.runAllTimersAsync()

      await expect(detailsPromise).rejects.toThrow('Operation timed out after 60 seconds')
    })

    it('always disconnects the client', async () => {
      await service.getTopicDetails(baseConfig)
      expect(mockClient.disconnect).toHaveBeenCalled()
    })
  })

  describe('fetchEvent', () => {
    it('returns event data on success', async () => {
      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
        format: 'JSON',
      })

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.offset).toBe('100')
    })

    it('returns error when topic is missing', async () => {
      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required parameters')
      expect(result.status).toBe(400)
    })

    it('handles timeout errors', async () => {
      mockClient.fetchSampleEvent = vi
        .fn()
        .mockImplementation(
          (topic: string, format?: string, getNext?: boolean, currentOffset?: string | null, options?: any) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => resolve({}), 65000)

              if (options?.abortSignal) {
                options.abortSignal.addEventListener('abort', () => {
                  clearTimeout(timeoutId)
                  reject(new Error('Operation aborted'))
                })
              }
            })
          },
        )

      const resultPromise = service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      await vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.success).toBe(false)
      expect(result.error).toContain('timed out')
    })

    it('handles circuit breaker errors', async () => {
      mockClient.fetchSampleEvent = vi
        .fn()
        .mockRejectedValue(new Error('Circuit breaker is open. Retry in 30 seconds.'))

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.isCircuitBreakerOpen).toBe(true)
    })

    it('handles end of topic errors', async () => {
      mockClient.fetchSampleEvent = vi.fn().mockRejectedValue(new Error('end of topic reached'))

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.isAtLatest).toBe(true)
      expect(result.error).toContain('End of topic reached')
    })

    it('handles beginning of topic errors', async () => {
      mockClient.fetchSampleEvent = vi.fn().mockRejectedValue(new Error('beginning of topic'))

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.isAtEarliest).toBe(true)
      expect(result.error).toContain('Beginning of topic reached')
    })

    it('handles empty topic errors', async () => {
      mockClient.fetchSampleEvent = vi.fn().mockRejectedValue(new Error('no events found'))

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.isEmptyTopic).toBe(true)
      expect(result.isAtLatest).toBe(true)
      expect(result.isAtEarliest).toBe(true)
    })

    it('handles generic errors', async () => {
      mockClient.fetchSampleEvent = vi.fn().mockRejectedValue(new Error('Unknown error'))

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('passes position options correctly', async () => {
      await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
        position: 'latest',
      })

      expect(mockClient.fetchSampleEvent).toHaveBeenCalledWith(
        'test-topic',
        undefined,
        false,
        null,
        expect.objectContaining({ position: 'latest' }),
      )
    })

    it('passes direction options correctly', async () => {
      await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
        direction: 'previous',
      })

      expect(mockClient.fetchSampleEvent).toHaveBeenCalledWith(
        'test-topic',
        undefined,
        false,
        null,
        expect.objectContaining({ direction: 'previous' }),
      )
    })

    it('throws error when fetchSampleEvent is not supported', async () => {
      mockClient.fetchSampleEvent = undefined

      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('fetchSampleEvent is not supported')
    })

    it('always disconnects the client on success', async () => {
      await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('always disconnects the client on error', async () => {
      mockClient.fetchSampleEvent = vi.fn().mockRejectedValue(new Error('Fetch error'))

      await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('always disconnects the client on timeout', async () => {
      mockClient.fetchSampleEvent = vi
        .fn()
        .mockImplementation(
          (topic: string, format?: string, getNext?: boolean, currentOffset?: string | null, options?: any) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => resolve({}), 65000)

              if (options?.abortSignal) {
                options.abortSignal.addEventListener('abort', () => {
                  clearTimeout(timeoutId)
                  reject(new Error('Operation aborted'))
                })
              }
            })
          },
        )

      const resultPromise = service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      await vi.runAllTimersAsync()
      await resultPromise

      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('passes abort signal to fetchSampleEvent', async () => {
      // Reset to fresh mock to track calls properly
      const fetchMock = vi.fn().mockResolvedValue({
        data: 'test',
        _metadata: { offset: '100', partition: 0, topic: 'topic1' },
      })
      mockClient.fetchSampleEvent = fetchMock

      await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
      })

      expect(fetchMock).toHaveBeenCalledWith(
        'test-topic',
        undefined,
        false,
        null,
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      )
    })

    it('returns correct metadata from event', async () => {
      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
        position: 'earliest',
      })

      expect(result.success).toBe(true)
      expect(result.metadata).toEqual({ offset: '100', partition: 0, topic: 'topic1' })
      expect(result.isAtEarliest).toBe(true)
      expect(result.hasMoreEvents).toBe(true)
    })

    it('returns hasMoreEvents false when at latest', async () => {
      const result = await service.fetchEvent({
        kafkaConfig: baseConfig,
        topic: 'test-topic',
        position: 'latest',
      })

      expect(result.success).toBe(true)
      expect(result.isAtLatest).toBe(true)
      expect(result.hasMoreEvents).toBe(false)
    })
  })
})
