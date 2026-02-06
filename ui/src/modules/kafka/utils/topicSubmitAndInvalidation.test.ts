import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  executeTopicSubmitAndInvalidation,
  type TopicSubmitState,
  type TopicSubmitStores,
} from './topicSubmitAndInvalidation'
import { StepKeys } from '@/src/config/constants'

vi.mock('@/src/utils/common.client', () => ({
  compareEventSchemas: vi.fn(),
}))

import { compareEventSchemas } from '@/src/utils/common.client'

function createMockStores(): TopicSubmitStores {
  return {
    topicsStore: {
      topics: {},
      updateTopic: vi.fn(),
    },
    deduplicationStore: {
      updateDeduplication: vi.fn(),
      markAsInvalidated: vi.fn(),
    },
    joinStore: {
      setEnabled: vi.fn(),
      setType: vi.fn(),
      setStreams: vi.fn(),
      markAsInvalidated: vi.fn(),
    },
    clickhouseDestinationStore: {
      clickhouseDestination: null,
      setClickhouseDestination: vi.fn(),
    },
    validationEngine: {
      invalidateSection: vi.fn(),
    },
  }
}

const baseState: TopicSubmitState = {
  index: 0,
  topicName: 'my-topic',
  offset: 'latest',
  event: { id: 1, name: 'a' },
  manualEvent: '',
  replicas: 2,
  effectivePartitionCount: 2,
  deduplicationConfig: { key: '', keyType: '', window: 0, unit: 'hours' },
  storedDeduplicationConfig: null,
  enableDeduplication: false,
  currentStep: StepKeys.TOPIC_SELECTION_1,
}

describe('executeTopicSubmitAndInvalidation', () => {
  let stores: TopicSubmitStores

  beforeEach(() => {
    vi.mocked(compareEventSchemas).mockReturnValue(true)
    stores = createMockStores()
  })

  describe('topic update', () => {
    it('calls topicsStore.updateTopic and deduplicationStore.updateDeduplication with expected shapes', () => {
      const originalTopicRef = { current: null as { name: string; event: unknown } | null }
      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.topicsStore.updateTopic).toHaveBeenCalledTimes(1)
      const topicPayload = vi.mocked(stores.topicsStore.updateTopic).mock.calls[0][0]
      expect(topicPayload).toMatchObject({
        index: 0,
        name: 'my-topic',
        initialOffset: 'latest',
        replicas: 2,
        partitionCount: 2,
      })
      expect(topicPayload.selectedEvent).toBeDefined()
      expect(topicPayload.selectedEvent.event).toEqual({ id: 1, name: 'a' })

      expect(stores.deduplicationStore.updateDeduplication).toHaveBeenCalledWith(0, {
        enabled: false,
        window: 0,
        unit: 'hours',
        key: '',
        keyType: '',
      })
    })
  })

  describe('invalidation – first event', () => {
    it('invalidates sections when previousEvent is null and finalEvent is set', () => {
      const originalTopicRef = { current: null }
      stores.topicsStore.topics = { 0: {} }

      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.joinStore.setEnabled).toHaveBeenCalledWith(false)
      expect(stores.joinStore.markAsInvalidated).toHaveBeenCalledWith('First event selection')
      expect(stores.validationEngine.invalidateSection).toHaveBeenCalled()
    })
  })

  describe('invalidation – topic changed', () => {
    it('invalidates when topicName !== previousTopicName and updates originalTopicRef when set', () => {
      vi.mocked(compareEventSchemas).mockReturnValue(true)
      const originalTopicRef = { current: { name: 'old-topic', event: { x: 1 } } }
      stores.topicsStore.topics = { 0: { name: 'old-topic', selectedEvent: { event: { x: 1 } } } }

      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.joinStore.setEnabled).toHaveBeenCalledWith(false)
      expect(stores.joinStore.markAsInvalidated).toHaveBeenCalledWith('Topic changed')
      expect(stores.validationEngine.invalidateSection).toHaveBeenCalled()
      expect(originalTopicRef.current).toEqual({ name: 'my-topic', event: baseState.event })
    })
  })

  describe('invalidation – schema changed, same topic', () => {
    it('invalidates when compareEventSchemas returns false for same topic', () => {
      vi.mocked(compareEventSchemas).mockReturnValue(false)
      const originalTopicRef = { current: { name: 'my-topic', event: { id: 1, other: 'old' } } }
      stores.topicsStore.topics = { 0: { name: 'my-topic', selectedEvent: { event: { id: 1, other: 'old' } } } }

      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.joinStore.markAsInvalidated).toHaveBeenCalledWith('Event schema changed')
      expect(stores.validationEngine.invalidateSection).toHaveBeenCalled()
      expect(originalTopicRef.current).toEqual({ name: 'my-topic', event: baseState.event })
    })
  })

  describe('no invalidation', () => {
    it('does not call invalidateSection when same topic and same schema (only topic/dedup update)', () => {
      vi.mocked(compareEventSchemas).mockReturnValue(true)
      const originalTopicRef = { current: { name: 'my-topic', event: { id: 1, name: 'a' } } }
      stores.topicsStore.topics = { 0: { name: 'my-topic', selectedEvent: { event: { id: 1, name: 'a' } } } }

      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.joinStore.setEnabled).not.toHaveBeenCalled()
      expect(stores.joinStore.markAsInvalidated).not.toHaveBeenCalled()
      expect(stores.validationEngine.invalidateSection).not.toHaveBeenCalled()
      expect(stores.topicsStore.updateTopic).toHaveBeenCalled()
      expect(stores.deduplicationStore.updateDeduplication).toHaveBeenCalled()
    })
  })

  describe('manual event', () => {
    it('uses valid manualEvent JSON as finalEvent', () => {
      const manualEvent = JSON.stringify({ manual: true, value: 42 })
      const state: TopicSubmitState = { ...baseState, manualEvent, event: null }
      const originalTopicRef = { current: null }
      stores.topicsStore.topics = { 0: {} }

      executeTopicSubmitAndInvalidation({ state, stores, originalTopicRef })

      const topicPayload = vi.mocked(stores.topicsStore.updateTopic).mock.calls[0][0]
      expect(topicPayload.selectedEvent.event).toEqual({ manual: true, value: 42 })
    })

    it('returns early without store updates when manualEvent is invalid JSON', () => {
      const state: TopicSubmitState = { ...baseState, manualEvent: 'not json', event: null }
      const originalTopicRef = { current: null }
      const updateTopic = vi.fn()
      stores.topicsStore.updateTopic = updateTopic

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      executeTopicSubmitAndInvalidation({ state, stores, originalTopicRef })

      expect(updateTopic).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('clickhouse mapping', () => {
    it('clears mapping when topic changed and clickhouseDestination exists', () => {
      const originalTopicRef = { current: { name: 'old-topic', event: {} } }
      stores.topicsStore.topics = { 0: { name: 'old-topic' } }
      stores.clickhouseDestinationStore.clickhouseDestination = { mapping: [{ source: 'a', target: 'b' }] }

      executeTopicSubmitAndInvalidation({ state: baseState, stores, originalTopicRef })

      expect(stores.clickhouseDestinationStore.setClickhouseDestination).toHaveBeenCalledWith(
        expect.objectContaining({ mapping: [] }),
      )
    })
  })
})
