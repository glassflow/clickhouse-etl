import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTopicEventState } from './useTopicEventState'

const mockFetchEvent = vi.fn()
const mockResetEventState = vi.fn()

vi.mock('@/src/hooks/useFetchKafkaEvents', () => ({
  useFetchEvent: () => ({
    fetchEvent: mockFetchEvent,
    event: null,
    isLoadingEvent: false,
    eventError: null,
    resetEventState: mockResetEventState,
  }),
}))

vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({
    topic: {
      eventReceived: vi.fn(),
      eventError: vi.fn(),
      noEvent: vi.fn(),
    },
  }),
}))

const mockKafkaStore = {} as import('@/src/store/kafka.store').KafkaStore

describe('useTopicEventState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not auto-fetch when effectiveEvent is provided (revisit / edit mode)', async () => {
    renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'latest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: { id: 1, payload: 'stored' },
      }),
    )

    await waitFor(() => {
      expect(mockFetchEvent).not.toHaveBeenCalled()
      expect(mockResetEventState).not.toHaveBeenCalled()
    })
  })

  it('does not auto-fetch for earliest offset when effectiveEvent is provided', async () => {
    renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'earliest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: { id: 0 },
      }),
    )

    await waitFor(() => {
      expect(mockFetchEvent).not.toHaveBeenCalled()
      expect(mockResetEventState).not.toHaveBeenCalled()
    })
  })

  it('auto-fetches when effectiveEvent is absent (first visit)', async () => {
    mockFetchEvent.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'latest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: null,
      }),
    )

    await waitFor(() => {
      expect(mockFetchEvent).toHaveBeenCalledWith('my-topic', false, { position: 'latest' })
      expect(mockResetEventState).toHaveBeenCalled()
    })

    expect(result.current.state.event).toBeNull()
  })

  it('auto-fetches earliest when effectiveEvent is absent and offset is earliest', async () => {
    mockFetchEvent.mockResolvedValue(undefined)

    renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'earliest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: undefined,
      }),
    )

    await waitFor(() => {
      expect(mockFetchEvent).toHaveBeenCalledWith('my-topic', false, { position: 'earliest' })
      expect(mockResetEventState).toHaveBeenCalled()
    })
  })

  it('sets event and offset flags from effectiveEvent when provided', async () => {
    const storedEvent = { id: 42, name: 'stored' }

    const { result } = renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'earliest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: storedEvent,
      }),
    )

    await waitFor(() => {
      expect(result.current.state.event).toEqual(storedEvent)
      expect(result.current.state.isAtEarliest).toBe(true)
      expect(result.current.state.isAtLatest).toBe(false)
    })
  })

  it('sets isAtLatest when effectiveEvent provided and offset is latest', async () => {
    const { result } = renderHook(() =>
      useTopicEventState({
        index: 0,
        topicName: 'my-topic',
        offset: 'latest',
        kafkaStore: mockKafkaStore,
        effectiveEvent: { x: 1 },
      }),
    )

    await waitFor(() => {
      expect(result.current.state.isAtLatest).toBe(true)
      expect(result.current.state.isAtEarliest).toBe(false)
    })
  })
})
