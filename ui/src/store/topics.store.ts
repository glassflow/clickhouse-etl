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
}

export interface TopicsStore extends TopicsStoreProps {
  // available topics actions
  setAvailableTopics: (topics: AvailableTopicsType) => void

  setTopicCount: (index: number) => void

  updateTopic: (topic: KafkaTopicType) => void

  getTopic: (index: number) => KafkaTopicType | undefined

  getEvent: (index: number, eventIndex: number) => KafkaEventType | undefined

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

    // actions
    setAvailableTopics: (topics: AvailableTopicsType) =>
      set((state) => ({ topicsStore: { ...state.topicsStore, availableTopics: topics } })),
    setTopicCount: (index: number) => set((state) => ({ topicsStore: { ...state.topicsStore, topicCount: index } })),
    updateTopic: (topic: KafkaTopicType) =>
      set((state) => ({
        topicsStore: { ...state.topicsStore, topics: { ...state.topicsStore.topics, [topic.index]: topic } },
      })),
    getTopic: (index: number) => get().topicsStore.topics[index],
    getEvent: (index: number, eventIndex: number) => get().topicsStore.topics[index]?.events?.[eventIndex],

    // New method to invalidate dependent state when topic changes
    invalidateTopicDependentState: (index: number) => {
      const topic = get().topicsStore.topics[index]
      if (!topic) return

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

    // reset topics store
    resetTopicsStore: () => {
      set((state) => ({
        topicsStore: {
          ...state.topicsStore,
          topics: {},
          availableTopics: [],
          topicCount: 0,
        },
      }))
    },
  },
})
