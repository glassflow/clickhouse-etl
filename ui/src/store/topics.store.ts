import { StateCreator } from 'zustand'
import { AvailableTopicsType, KafkaEventType, KafkaTopicType, KafkaTopicsType } from '@/src/scheme/topics.scheme'
import { create } from 'zustand'

// New type definitions for event caching
type KafkaEventCache = {
  topicName: string
  events: Record<number, any> // Map of offset -> event
  minOffset: number
  maxOffset: number
  latestOffset: number
  currentOffset: number
}

export interface TopicsStoreProps {
  // available topics
  availableTopics: string[]

  // topic count
  topicCount: number

  // topics and events - new approach
  topics: KafkaTopicsType

  // Add event cache
  eventCache: Record<string, KafkaEventCache>
}

export interface TopicsStore extends TopicsStoreProps {
  // available topics actions
  setAvailableTopics: (topics: AvailableTopicsType) => void

  setTopicCount: (index: number) => void

  setTopicDeduplicationWindow: (window: number, unit: 'seconds' | 'minutes' | 'hours' | 'days') => void

  setTopicSelectedEvent: (event: KafkaEventType) => void

  setTopicEvents: (events: KafkaEventType[]) => void

  addTopic: (topic: KafkaTopicType) => void

  updateTopic: (topic: KafkaTopicType) => void

  getTopic: (index: number) => KafkaTopicType | undefined

  getSelectedEvent: (index: number) => KafkaEventType | undefined

  getEvent: (index: number, eventIndex: number) => KafkaEventType | undefined

  // Add new methods
  getEventFromCache: (topicName: string, offset: number) => any
  addEventToCache: (topicName: string, offset: number, event: any) => void
  updateEventCache: (topicName: string, cacheUpdate: Partial<KafkaEventCache>) => void
  clearEventCache: (topicName?: string) => void
  getIsTopicDirty: () => boolean

  // New method to invalidate dependent state
  invalidateTopicDependentState: (index: number) => void

  resetTopicsStore: () => void
}

export interface TopicsSlice {
  topicsStore: TopicsStore
}

export const createTopicsSlice: StateCreator<TopicsSlice> = (set, get) => ({
  topicsStore: {
    // state
    availableTopics: [],
    topicCount: 0,
    topics: {},
    eventCache: {},

    // actions
    setAvailableTopics: (topics: AvailableTopicsType) =>
      set((state) => ({ topicsStore: { ...state.topicsStore, availableTopics: topics } })),
    setTopicCount: (index: number) => set((state) => ({ topicsStore: { ...state.topicsStore, topicCount: index } })),
    setTopicDeduplicationWindow: (window: number, unit: 'seconds' | 'minutes' | 'hours' | 'days') =>
      set((state) => ({ topicsStore: { ...state.topicsStore, deduplicationWindow: { window, unit } } })),
    setTopicEvents: (events: KafkaEventType[]) =>
      set((state) => ({ topicsStore: { ...state.topicsStore, events: events } })),
    setTopicSelectedEvent: (event: KafkaEventType) =>
      set((state) => ({ topicsStore: { ...state.topicsStore, selectedEvent: event } })),
    addTopic: (topic: KafkaTopicType) =>
      set((state) => ({
        topicsStore: { ...state.topicsStore, topics: { ...state.topicsStore.topics, [topic.index]: topic } },
      })),
    updateTopic: (topic: KafkaTopicType) =>
      set((state) => ({
        topicsStore: { ...state.topicsStore, topics: { ...state.topicsStore.topics, [topic.index]: topic } },
      })),
    getTopic: (index: number) => get().topicsStore.topics[index],
    getEvent: (index: number, eventIndex: number) => get().topicsStore.topics[index]?.events?.[eventIndex],
    getSelectedEvent: (index: number) => get().topicsStore.topics[index]?.selectedEvent,

    // Get event from cache
    getEventFromCache: (topicName, offset) => {
      const cache = get().topicsStore.eventCache[topicName]
      if (cache && cache.events[offset] !== undefined) {
        return cache.events[offset]
      }
      return null
    },

    // Add event to cache
    addEventToCache: (topicName, offset, event) => {
      set((state) => {
        // Get existing cache or create new one
        const existingCache = state.topicsStore.eventCache[topicName] || {
          topicName,
          events: {},
          minOffset: Infinity,
          maxOffset: -Infinity,
          latestOffset: -1,
          currentOffset: offset,
        }

        // Update min/max offsets
        const minOffset = Math.min(existingCache.minOffset, offset)
        const maxOffset = Math.max(existingCache.maxOffset, offset)

        // Create updated cache
        const updatedCache = {
          ...existingCache,
          events: {
            ...existingCache.events,
            [offset]: event,
          },
          minOffset,
          maxOffset,
          currentOffset: offset,
        }

        // Return updated state
        return {
          topicsStore: {
            ...state.topicsStore,
            eventCache: {
              ...state.topicsStore.eventCache,
              [topicName]: updatedCache,
            },
          },
        }
      })
    },

    // Update event cache properties
    updateEventCache: (topicName, cacheUpdate) => {
      set((state) => {
        const existingCache = state.topicsStore.eventCache[topicName] || {
          topicName,
          events: {},
          minOffset: Infinity,
          maxOffset: -Infinity,
          latestOffset: -1,
          currentOffset: 0,
        }

        return {
          topicsStore: {
            ...state.topicsStore,
            eventCache: {
              ...state.topicsStore.eventCache,
              [topicName]: {
                ...existingCache,
                ...cacheUpdate,
              },
            },
          },
        }
      })
    },

    // Clear event cache
    clearEventCache: (topicName) => {
      set((state) => {
        if (topicName) {
          // Clear specific topic cache
          const { [topicName]: _, ...restCache } = state.topicsStore.eventCache
          return { topicsStore: { ...state.topicsStore, eventCache: restCache } }
        } else {
          // Clear all caches
          return { topicsStore: { ...state.topicsStore, eventCache: {} } }
        }
      })
    },

    // New method to invalidate dependent state when topic changes
    invalidateTopicDependentState: (index: number) => {
      const topic = get().topicsStore.topics[index]
      if (!topic) return

      // First, clear cache for this topic
      if (topic.name) {
        get().topicsStore.clearEventCache(topic.name)
      }

      // Clear join store as well - access from the root store object
      // We need to cast to any to access the joinStore from another slice
      const store = get() as any
      if (store.joinStore) {
        store.joinStore.setEnabled(false)
        store.joinStore.setType('')
        store.joinStore.setStreams([])
      }

      // Then update the topic to remove dependent state
      set((state) => {
        // Keep only these properties, remove all others
        const cleanedTopic = {
          name: topic.name,
          index: topic.index,
          initialOffset: topic.initialOffset,
          events: [],
          selectedEvent: {
            topicIndex: index,
            position: topic.initialOffset,
            event: null,
          },
        }

        return {
          topicsStore: {
            ...state.topicsStore,
            topics: {
              ...state.topicsStore.topics,
              [index]: cleanedTopic as KafkaTopicType,
            },
          },
        }
      })
    },

    getIsTopicDirty: () => {
      const { topics } = get().topicsStore
      return Object.keys(topics).length > 0
    },

    // reset topics store
    resetTopicsStore: () => {
      set((state) => ({
        topicsStore: {
          ...state.topicsStore,
          topics: {},
          eventCache: {},
          availableTopics: [],
          topicCount: 0,
        },
      }))
    },
  },
})
