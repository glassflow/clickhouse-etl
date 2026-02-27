import { StepKeys } from '@/src/config/constants'
import { compareEventSchemas } from '@/src/utils/common.client'
import { getSectionsToInvalidateForTopicStep } from './topicStepKeys'
import { structuredLogger } from '@/src/observability'

export interface TopicSubmitState {
  index: number
  topicName: string
  offset: 'earliest' | 'latest'
  event: unknown
  manualEvent: string
  replicas: number
  effectivePartitionCount: number
  deduplicationConfig: { key: string; keyType: string; window: number; unit: string }
  storedDeduplicationConfig: unknown
  enableDeduplication: boolean
  currentStep?: string
}

/** Minimal store shape required by executeTopicSubmitAndInvalidation (allows actual store types). */
export interface TopicSubmitStores {
  topicsStore: {
    topics: Record<number, { name?: string; selectedEvent?: { event?: unknown }; partitionCount?: number }>
    updateTopic: (topic: Record<string, unknown>) => void
  }
  deduplicationStore: {
    updateDeduplication: (index: number, data: Record<string, unknown>) => void
    markAsInvalidated: (reason: string) => void
  }
  joinStore: {
    setEnabled: (enabled: boolean) => void
    setType: (type: string) => void
    setStreams: (streams: Array<Record<string, unknown>>) => void
    markAsInvalidated: (reason: string) => void
  }
  clickhouseDestinationStore: {
    clickhouseDestination: Record<string, unknown> | null
    setClickhouseDestination: (dest: Record<string, unknown>) => void
  }
  validationEngine: {
    invalidateSection: (step: string, reason: string) => void
  }
}

export interface TopicSubmitParams {
  state: TopicSubmitState
  stores: TopicSubmitStores
  originalTopicRef: { current: { name: string; event: unknown } | null }
}

/**
 * Performs topic submit: updates topic and deduplication in store,
 * then runs smart invalidation (schema comparison, topic change detection).
 * Used by useKafkaTopicSelectorState.
 */
export function executeTopicSubmitAndInvalidation({ state, stores, originalTopicRef }: TopicSubmitParams): void {
  const {
    index,
    topicName,
    offset,
    event: stateEvent,
    manualEvent,
    replicas,
    effectivePartitionCount,
    deduplicationConfig,
    storedDeduplicationConfig,
    enableDeduplication,
    currentStep,
  } = state
  const { topicsStore, deduplicationStore, joinStore, clickhouseDestinationStore, validationEngine } = stores

  let finalEvent: unknown = null
  try {
    finalEvent = (manualEvent ? JSON.parse(manualEvent) : null) || stateEvent
  } catch (e) {
    structuredLogger.error('Error parsing event', { error: e instanceof Error ? e.message : String(e) })
    return
  }

  const previousTopicName = originalTopicRef.current?.name || topicsStore.topics[index]?.name
  let previousEvent = originalTopicRef.current?.event || topicsStore.topics[index]?.selectedEvent?.event

  if (!previousEvent && finalEvent && topicName === previousTopicName) {
    previousEvent = finalEvent
  }

  if (!finalEvent && previousEvent) {
    finalEvent = previousEvent
  } else if (!finalEvent && !previousEvent) {
    structuredLogger.warn('Topic Submit neither finalEvent nor previousEvent exists')
  }

  const topicData = {
    index,
    name: topicName,
    initialOffset: offset,
    events: [{ event: finalEvent, topicIndex: index, position: offset, isManualEvent: manualEvent !== '' }],
    selectedEvent: {
      event: finalEvent,
      topicIndex: index,
      position: offset,
      isManualEvent: manualEvent !== '',
    },
    replicas,
    partitionCount: effectivePartitionCount,
  }

  const hasDeduplicationConfig = !!(deduplicationConfig.key && deduplicationConfig.window)
  const deduplicationData: Record<string, unknown> =
    enableDeduplication && hasDeduplicationConfig
      ? {
          enabled: true,
          window: deduplicationConfig.window,
          unit: deduplicationConfig.unit,
          key: deduplicationConfig.key,
          keyType: deduplicationConfig.keyType,
        }
      : (storedDeduplicationConfig as Record<string, unknown>) || {
          enabled: false,
          window: 0,
          unit: 'hours',
          key: '',
          keyType: '',
        }

  topicsStore.updateTopic(topicData)
  deduplicationStore.updateDeduplication(index, deduplicationData)

  let shouldInvalidate = false
  let invalidationReason = ''

  if (!previousEvent) {
    shouldInvalidate = true
    invalidationReason = 'First event selection'
  } else if (!finalEvent) {
    shouldInvalidate = true
    invalidationReason = 'Missing current event'
  } else if (topicName !== previousTopicName) {
    shouldInvalidate = true
    invalidationReason = 'Topic changed'
  } else {
    const schemasMatch = compareEventSchemas(previousEvent, finalEvent)
    if (!schemasMatch) {
      shouldInvalidate = true
      invalidationReason = 'Event schema changed'
    }
  }

  if (shouldInvalidate) {
    const isTopicChange = topicName !== previousTopicName

    joinStore.setEnabled(false)
    joinStore.setType('')
    joinStore.setStreams([])
    joinStore.markAsInvalidated(invalidationReason)

    const isEmbeddedDedup = currentStep === StepKeys.TOPIC_SELECTION_1 && enableDeduplication // topic-selection-1 with dedup
    if (isTopicChange && isEmbeddedDedup) {
      deduplicationStore.updateDeduplication(index, {
        enabled: false,
        window: 0,
        unit: 'hours',
        key: '',
        keyType: '',
      })
    }
    if (isTopicChange && !isEmbeddedDedup) {
      deduplicationStore.markAsInvalidated(`topic-selection-${index + 1}`)
    }

    const currentDestination = clickhouseDestinationStore.clickhouseDestination as Record<string, unknown> | null
    if (currentDestination && (isTopicChange || invalidationReason === 'Event schema changed')) {
      clickhouseDestinationStore.setClickhouseDestination({
        ...currentDestination,
        mapping: [],
      })
    }

    const sectionsToInvalidate = currentStep ? getSectionsToInvalidateForTopicStep(currentStep) : []
    for (const step of sectionsToInvalidate) {
      validationEngine.invalidateSection(step, invalidationReason)
    }
  }

  if (originalTopicRef.current) {
    originalTopicRef.current = { name: topicName, event: finalEvent }
  }
}
