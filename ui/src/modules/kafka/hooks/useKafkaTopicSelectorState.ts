import { useCallback, useEffect, useMemo } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { useTopicOffsetReplicaState } from './useTopicOffsetReplicaState'
import { useTopicEventState } from './useTopicEventState'
import { useTopicDeduplicationState } from './useTopicDeduplicationState'
import { executeTopicSubmitAndInvalidation } from '@/src/modules/kafka/utils/topicSubmitAndInvalidation'
import type { EventFetchState } from './useTopicEventState'

export type { EventFetchState }

interface UseTopicSelectionStateProps {
  index: number
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: import('@/src/store/deduplication.store').DeduplicationConfig) => void
  initialDeduplicationConfig?: unknown
  currentStep?: string
}

export function useKafkaTopicSelectorState({
  index,
  enableDeduplication = false,
  onDeduplicationChange,
  initialDeduplicationConfig,
  currentStep,
}: UseTopicSelectionStateProps) {
  const { topicsStore, deduplicationStore, kafkaStore, joinStore, clickhouseDestinationStore } = useStore()
  const validationEngine = useValidationEngine()
  const analytics = useJourneyAnalytics()

  const topicReplica = useTopicOffsetReplicaState(index, currentStep)
  const { topicName, offset, replicas, storedTopic, effectivePartitionCount, originalTopicRef } = topicReplica
  const effectiveEvent = storedTopic?.selectedEvent?.event

  const eventState = useTopicEventState({
    index,
    topicName,
    offset,
    kafkaStore,
    effectiveEvent,
  })
  const {
    state: eventFetchState,
    manualEvent,
    isManualEventValid,
    fetchNewestEvent,
    fetchOldestEvent,
    fetchNextEvent,
    fetchPreviousEvent,
    refreshEvent,
    handleManualEventChange,
  } = eventState

  const dedupState = useTopicDeduplicationState({
    index,
    enableDeduplication,
    onDeduplicationChange,
    initialDeduplicationConfig: initialDeduplicationConfig as
      | { key?: string; keyType?: string; window?: number; unit?: string }
      | undefined,
  })
  const { deduplicationConfig, deduplicationConfigured, storedDeduplicationConfig, configureDeduplication } = dedupState

  useEffect(() => {
    const isJoinOperation =
      currentStep === StepKeys.TOPIC_SELECTION_2 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    if (isJoinOperation) {
      if (index === 0) {
        analytics.page.selectLeftTopic({})
      } else {
        analytics.page.selectRightTopic({})
      }
    } else {
      analytics.page.selectTopic({})
    }
    if (enableDeduplication) {
      analytics.page.topicDeduplication({})
    }
  }, [enableDeduplication, index, currentStep, analytics.page])

  const canContinue = useMemo(() => {
    const hasValidTopic = topicName && (eventFetchState.event || (manualEvent && isManualEventValid))
    if (!enableDeduplication) return hasValidTopic
    return hasValidTopic && deduplicationConfigured
  }, [topicName, eventFetchState.event, manualEvent, isManualEventValid, enableDeduplication, deduplicationConfigured])

  const handleSubmit = useCallback(() => {
    executeTopicSubmitAndInvalidation({
      state: {
        index,
        topicName,
        offset,
        event: eventFetchState.event,
        manualEvent,
        replicas,
        effectivePartitionCount,
        deduplicationConfig,
        storedDeduplicationConfig,
        enableDeduplication,
        currentStep,
      },
      stores: {
        topicsStore,
        deduplicationStore,
        joinStore,
        clickhouseDestinationStore,
        validationEngine,
      } as unknown as import('@/src/modules/kafka/utils/topicSubmitAndInvalidation').TopicSubmitStores,
      originalTopicRef,
    })
  }, [
    index,
    topicName,
    offset,
    eventFetchState.event,
    manualEvent,
    replicas,
    effectivePartitionCount,
    deduplicationConfig,
    storedDeduplicationConfig,
    enableDeduplication,
    currentStep,
    topicsStore,
    deduplicationStore,
    joinStore,
    clickhouseDestinationStore,
    validationEngine,
    originalTopicRef,
  ])

  return {
    topicName,
    offset,
    event: eventFetchState.event,
    isLoading: eventFetchState.isLoading,
    isEmptyTopic: eventFetchState.isEmptyTopic,
    error: eventFetchState.error,
    deduplicationConfig,
    deduplicationConfigured,
    canContinue,
    manualEvent,
    isManualEventValid,
    replicas,
    partitionCount: effectivePartitionCount,
    currentOffset: eventFetchState.currentOffset,
    earliestOffset: eventFetchState.earliestOffset,
    latestOffset: eventFetchState.latestOffset,
    isAtLatest: eventFetchState.isAtLatest,
    isAtEarliest: eventFetchState.isAtEarliest,
    selectTopic: topicReplica.selectTopic,
    selectOffset: topicReplica.handleOffsetChange,
    selectReplicaCount: topicReplica.handleReplicaCountChange,
    updatePartitionCount: topicReplica.updatePartitionCount,
    configureDeduplication,
    handleManualEventChange,
    submit: handleSubmit,
    fetchNewestEvent,
    fetchOldestEvent,
    fetchNextEvent,
    fetchPreviousEvent,
    refreshEvent,
  }
}
