import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { useFetchTopics } from '@/src/hooks/useFetchKafkaTopics'

const MAX_TOPIC_FETCH_ATTEMPTS = 3

export interface UseTopicSelectorTopicsParams {
  topicName?: string
  partitionCount?: number
  replicas?: number
  updatePartitionCount?: (count: number) => void
  selectReplicaCount?: (count: number) => void
}

/**
 * Encapsulates topic fetching, syncing available topics to store, and partition/replica sync
 * when topic details are loaded. Used by KafkaTopicSelector so the container stays thin.
 */
export function useTopicSelectorTopics(params: UseTopicSelectorTopicsParams = {}) {
  const { topicsStore, kafkaStore } = useStore()
  const { topicName, partitionCount = 0, replicas = 1, updatePartitionCount, selectReplicaCount } = params

  const {
    topics: topicsFromKafka,
    topicDetails,
    isLoadingTopics,
    topicsError,
    fetchTopics,
    getPartitionCount,
  } = useFetchTopics({ kafka: kafkaStore })

  const { availableTopics, setAvailableTopics } = topicsStore
  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)

  // Fetch topics on mount when availableTopics is empty (with retry cap)
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoadingTopics && topicFetchAttempts < MAX_TOPIC_FETCH_ATTEMPTS) {
      setTopicFetchAttempts((prev) => prev + 1)
      fetchTopics()
    }
    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [availableTopics.length, fetchTopics, isLoadingTopics, isInitialRender, topicFetchAttempts])

  // Fetch topic details when topics exist but details don't (e.g. edit mode hydration)
  useEffect(() => {
    if (availableTopics.length > 0 && topicDetails.length === 0 && !isLoadingTopics) {
      fetchTopics()
    }
  }, [availableTopics.length, topicDetails.length, fetchTopics, isLoadingTopics])

  // Sync fetched topics to store
  useEffect(() => {
    if (topicsFromKafka.length > 0) {
      setAvailableTopics(topicsFromKafka)
    }
  }, [topicsFromKafka, setAvailableTopics])

  // Update partition count and replica count when topic details are fetched
  useEffect(() => {
    if (!topicName || topicDetails.length === 0 || !updatePartitionCount || !selectReplicaCount) return
    const fetchedPartitionCount = getPartitionCount(topicName)
    if (fetchedPartitionCount > 0 && fetchedPartitionCount !== partitionCount) {
      updatePartitionCount(fetchedPartitionCount)
      if (replicas === 1 && fetchedPartitionCount > 1) {
        selectReplicaCount(fetchedPartitionCount)
      }
    }
  }, [topicName, topicDetails, getPartitionCount, partitionCount, replicas, updatePartitionCount, selectReplicaCount])

  return {
    availableTopics,
    fetchTopics,
    getPartitionCount,
    isLoadingTopics,
    topicsError,
  }
}
