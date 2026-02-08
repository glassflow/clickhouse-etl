import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/src/store'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import type { KafkaTopicType } from '@/src/scheme/topics.scheme'

export interface TopicOffsetReplicaState {
  topicName: string
  offset: 'earliest' | 'latest'
  replicas: number
  storedTopic: KafkaTopicType | undefined
  effectiveTopicName: string
  effectiveOffset: string
  effectiveReplicas: number
  effectivePartitionCount: number
  originalTopicRef: React.MutableRefObject<{ name: string; event: unknown } | null>
  selectTopic: (newTopicName: string) => void
  handleOffsetChange: (newOffset: 'earliest' | 'latest') => void
  handleReplicaCountChange: (newReplicaCount: number) => void
  updatePartitionCount: (newPartitionCount: number) => void
}

export function useTopicOffsetReplicaState(index: number, currentStep?: string): TopicOffsetReplicaState {
  const { topicsStore, joinStore } = useStore()
  const analytics = useJourneyAnalytics()

  const originalTopicRef = useRef<{ name: string; event: unknown } | null>(null)

  const [topicName, setTopicName] = useState('')
  const [offset, setOffset] = useState<'earliest' | 'latest'>('latest')
  const [replicas, setReplicas] = useState<number>(1)

  const storedTopic = topicsStore.topics[index]
  const effectiveTopicName = storedTopic?.name ?? ''
  const effectiveEvent = storedTopic?.selectedEvent?.event
  const effectiveOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST
  const effectiveReplicas = storedTopic?.replicas ?? 1
  const effectivePartitionCount = storedTopic?.partitionCount ?? 0

  useEffect(() => {
    if (effectiveTopicName && effectiveTopicName !== topicName) {
      setTopicName(effectiveTopicName)
    }
    if (effectiveOffset && effectiveOffset !== offset) {
      setOffset(effectiveOffset as 'earliest' | 'latest')
    }
    if (effectiveReplicas !== undefined && effectiveReplicas !== replicas) {
      setReplicas(effectiveReplicas)
    }
    if (effectiveTopicName && effectiveEvent && !originalTopicRef.current) {
      originalTopicRef.current = { name: effectiveTopicName, event: effectiveEvent }
    }
  }, [effectiveTopicName, effectiveOffset, effectiveReplicas, effectiveEvent, topicName, offset, replicas])

  const selectTopic = useCallback(
    (newTopicName: string) => {
      const currentTopic = topicsStore.getTopic(index)
      if (currentTopic && newTopicName === currentTopic.name) return

      setTopicName(newTopicName)
      const topicData = {
        ...(currentTopic || {}),
        index,
        name: newTopicName,
        initialOffset: currentTopic?.initialOffset || 'latest',
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: currentTopic?.initialOffset || 'latest',
        },
        replicas: currentTopic?.replicas || 1,
        partitionCount: 0,
      }
      topicsStore.updateTopic(topicData)

      if (joinStore.enabled && joinStore.streams.length > 0) {
        const updatedStreams = joinStore.streams.map((stream, streamIndex) =>
          streamIndex === index ? { ...stream, topicName: newTopicName } : stream,
        )
        joinStore.setStreams(updatedStreams)
      }

      analytics.topic.selected({ offset })
    },
    [index, offset, topicsStore, joinStore, analytics.topic],
  )

  const handleOffsetChange = useCallback(
    (newOffset: 'earliest' | 'latest') => {
      const currentTopic = topicsStore.getTopic(index)
      if (currentTopic && newOffset === currentTopic.initialOffset) return

      setOffset(newOffset)
      const topicData = {
        ...(currentTopic || {}),
        index,
        name: currentTopic?.name || '',
        initialOffset: newOffset,
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: newOffset,
        },
        replicas: currentTopic?.replicas || 1,
        partitionCount: currentTopic?.partitionCount || 0,
      }
      topicsStore.updateTopic(topicData)
    },
    [index, topicsStore],
  )

  const handleReplicaCountChange = useCallback(
    (newReplicaCount: number) => {
      const currentTopic = topicsStore.getTopic(index)
      if (!currentTopic || newReplicaCount === currentTopic.replicas) return

      setReplicas(newReplicaCount)
      topicsStore.updateTopic({ ...currentTopic, replicas: newReplicaCount })
    },
    [index, topicsStore],
  )

  const updatePartitionCount = useCallback(
    (newPartitionCount: number) => {
      const currentTopic = topicsStore.getTopic(index)
      if (!currentTopic || newPartitionCount === currentTopic.partitionCount) return
      topicsStore.updateTopic({ ...currentTopic, partitionCount: newPartitionCount })
    },
    [index, topicsStore],
  )

  return {
    topicName,
    offset,
    replicas,
    storedTopic,
    effectiveTopicName,
    effectiveOffset,
    effectiveReplicas,
    effectivePartitionCount,
    originalTopicRef,
    selectTopic,
    handleOffsetChange,
    handleReplicaCountChange,
    updatePartitionCount,
  }
}
