import { useStore } from './index'
import { DeduplicationConfig } from './deduplication.store'

/**
 * Migration helper to get deduplication config from the new deduplication store
 * This helps components transition from the old structure where deduplication was embedded in topics
 */
export const useDeduplicationConfig = (topicIndex: number) => {
  const { deduplicationStore } = useStore()

  return {
    deduplicationConfig: deduplicationStore.getDeduplication(topicIndex),
    updateDeduplication: deduplicationStore.updateDeduplication,
    invalidateDeduplication: deduplicationStore.invalidateDeduplication,
  }
}

/**
 * Migration helper to get topic data without deduplication
 * This helps components that only need topic data, not deduplication
 */
export const useTopicData = (topicIndex: number) => {
  const { topicsStore } = useStore()

  return {
    topic: topicsStore.getTopic(topicIndex),
    updateTopic: topicsStore.updateTopic,
    invalidateTopic: topicsStore.invalidateTopicDependentState,
  }
}

/**
 * Migration helper to get both topic and deduplication data
 * This helps components that need both but want to use the new separated structure
 */
export const useTopicAndDeduplication = (topicIndex: number) => {
  const { topicsStore, deduplicationStore } = useStore()

  return {
    // Topic data
    topic: topicsStore.getTopic(topicIndex),
    updateTopic: topicsStore.updateTopic,
    invalidateTopic: topicsStore.invalidateTopicDependentState,

    // Deduplication data
    deduplicationConfig: deduplicationStore.getDeduplication(topicIndex),
    updateDeduplication: deduplicationStore.updateDeduplication,
    invalidateDeduplication: deduplicationStore.invalidateDeduplication,
  }
}

/**
 * Helper to migrate existing topic data to the new structure
 * This can be used when hydrating data from existing pipelines
 */
export const migrateTopicToNewStructure = (oldTopic: any, topicIndex: number) => {
  const { topicsStore, deduplicationStore } = useStore.getState()

  // Extract deduplication config from old topic
  const deduplicationConfig = oldTopic?.deduplication
    ? {
        enabled: oldTopic.deduplication.enabled,
        window: oldTopic.deduplication.window || 0,
        unit: oldTopic.deduplication.unit || 'hours',
        key: oldTopic.deduplication.key || '',
        keyType: oldTopic.deduplication.keyType || 'string',
      }
    : {
        enabled: false,
        window: 0,
        unit: 'hours',
        key: '',
        keyType: '',
      }

  // Create new topic without deduplication
  const newTopic = {
    ...oldTopic,
    deduplication: undefined, // Remove deduplication from topic
  }

  // Update both stores
  topicsStore.updateTopic(newTopic)
  deduplicationStore.updateDeduplication(topicIndex, deduplicationConfig)
}

/**
 * Helper to get the combined topic data for backward compatibility
 * This can be used during the migration period when some components still expect the old structure
 */
export const getCombinedTopicData = (topicIndex: number) => {
  const { topicsStore, deduplicationStore } = useStore.getState()

  const topic = topicsStore.getTopic(topicIndex)
  const deduplicationConfig = deduplicationStore.getDeduplication(topicIndex)

  if (!topic) return null

  return {
    ...topic,
    deduplication: deduplicationConfig,
  }
}
