import { useState, useCallback, useEffect, useMemo } from 'react'
import { useStore } from '@/src/store'
import { useEventManagerState } from './useEventManagerState'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { KafkaEventType } from '@/src/scheme/topics.scheme'

interface UseTopicSelectionStateProps {
  index: number
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: any) => void
  initialDeduplicationConfig?: any
}

export function useTopicSelectionState({
  index,
  enableDeduplication = false,
  onDeduplicationChange,
  initialDeduplicationConfig,
}: UseTopicSelectionStateProps) {
  const { topicsStore, deduplicationStore, topicSelectionDraft } = useStore()

  // Topic selection state
  const [topicName, setTopicName] = useState('')
  const [offset, setOffset] = useState<'earliest' | 'latest'>('latest')

  // Get existing topic data
  const storedTopic = topicsStore.topics[index]
  const storedTopicName = storedTopic?.name
  const storedEvent = storedTopic?.selectedEvent?.event
  const storedOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST

  // Draft mode handling
  const isDraftMode = topicSelectionDraft.isEditing
  const effectiveTopic = isDraftMode ? topicSelectionDraft.draftTopics[index] : storedTopic
  const effectiveTopicName = effectiveTopic?.name
  const effectiveEvent = effectiveTopic?.selectedEvent?.event
  const effectiveOffset = effectiveTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST

  // Deduplication state
  const storedDeduplicationConfig = deduplicationStore.getDeduplication(index)
  const effectiveDeduplicationConfig = isDraftMode
    ? topicSelectionDraft.draftDeduplication[index]
    : storedDeduplicationConfig

  const [deduplicationConfig, setDeduplicationConfig] = useState({
    key: initialDeduplicationConfig?.key || effectiveDeduplicationConfig?.key || '',
    keyType: initialDeduplicationConfig?.keyType || effectiveDeduplicationConfig?.keyType || 'string',
    window: initialDeduplicationConfig?.window || effectiveDeduplicationConfig?.window || 1,
    unit: initialDeduplicationConfig?.unit || effectiveDeduplicationConfig?.unit || 'hours',
  })

  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(initialDeduplicationConfig?.key || (effectiveDeduplicationConfig?.key && effectiveDeduplicationConfig?.window)),
  )

  // Event state using the orchestrator hook
  const eventState = useEventManagerState({
    topicName: effectiveTopicName || '',
    initialOffset: effectiveOffset,
    initialEvent: effectiveEvent,
    topicIndex: index,
    onEventLoading: () => {
      // Handle loading state if needed
    },
    onEventLoaded: (event: KafkaEventType) => {
      // Event loaded callback
    },
    onEventError: (error: any) => {
      // Handle error if needed
    },
    onEmptyTopic: () => {
      // Handle empty topic if needed
    },
  })

  // Initialize from existing data
  useEffect(() => {
    if (effectiveTopicName) {
      setTopicName(effectiveTopicName)
    }
    if (effectiveOffset) {
      setOffset(effectiveOffset as 'earliest' | 'latest')
    }
  }, [effectiveTopicName, effectiveOffset])

  // Handle topic change
  const handleTopicChange = useCallback(
    (newTopicName: string) => {
      setTopicName(newTopicName)

      // Create topic data
      const topicData = {
        index,
        name: newTopicName,
        initialOffset: offset,
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: offset,
        },
      }

      // Update store (draft or real)
      if (isDraftMode) {
        topicSelectionDraft.updateDraftTopic(index, topicData)
      } else {
        topicsStore.updateTopic(topicData)
      }

      // Clear join store when topic changes
      const { joinStore } = useStore.getState()
      joinStore.setEnabled(false)
      joinStore.setType('')
      joinStore.setStreams([])

      // Invalidate dependent state
      topicsStore.invalidateTopicDependentState(index)
    },
    [index, offset, isDraftMode, topicsStore, topicSelectionDraft],
  )

  // Handle offset change
  const handleOffsetChange = useCallback(
    (newOffset: 'earliest' | 'latest') => {
      setOffset(newOffset)

      // Create topic data
      const topicData = {
        index,
        name: topicName,
        initialOffset: newOffset,
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: newOffset,
        },
      }

      // Update store (draft or real)
      if (isDraftMode) {
        topicSelectionDraft.updateDraftTopic(index, topicData)
      } else {
        topicsStore.updateTopic(topicData)
      }
    },
    [index, topicName, isDraftMode, topicsStore, topicSelectionDraft],
  )

  // Handle deduplication config change
  const handleDeduplicationConfigChange = useCallback(
    (newKeyConfig: { key: string; keyType: string }, newWindowConfig: { window: number; unit: string }) => {
      const updatedConfig = {
        key: newKeyConfig.key,
        keyType: newKeyConfig.keyType,
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      }

      setDeduplicationConfig(updatedConfig)

      // Update deduplication status
      const isConfigured = !!(newKeyConfig.key && newWindowConfig.window)
      setDeduplicationConfigured(isConfigured)

      // Update store (draft or real)
      const deduplicationData = {
        enabled: isConfigured,
        ...updatedConfig,
      }

      if (isDraftMode) {
        topicSelectionDraft.updateDraftDeduplication(index, deduplicationData)
      } else {
        deduplicationStore.updateDeduplication(index, deduplicationData)
      }

      // Notify parent component if callback provided
      if (onDeduplicationChange) {
        onDeduplicationChange(deduplicationData)
      }
    },
    [index, isDraftMode, topicSelectionDraft, deduplicationStore, onDeduplicationChange],
  )

  // Determine if we can continue
  const canContinue = useMemo(() => {
    const hasValidTopic = topicName && (eventState.event || eventState.isEmptyTopic)

    if (!enableDeduplication) {
      return hasValidTopic
    }

    // For deduplication mode, also require deduplication config
    return hasValidTopic && deduplicationConfigured
  }, [topicName, eventState.event, eventState.isEmptyTopic, enableDeduplication, deduplicationConfigured])

  // Submit handler
  const handleSubmit = useCallback(() => {
    // Create final topic data
    const topicData = {
      index,
      name: topicName,
      initialOffset: offset,
      events: eventState.event ? [eventState.event] : [],
      selectedEvent: eventState.event || {
        event: undefined,
        topicIndex: index,
        position: offset,
      },
    }

    // Create deduplication data
    const deduplicationData =
      enableDeduplication && deduplicationConfigured
        ? {
            enabled: true,
            window: deduplicationConfig.window,
            unit: deduplicationConfig.unit,
            key: deduplicationConfig.key,
            keyType: deduplicationConfig.keyType,
          }
        : storedDeduplicationConfig || {
            enabled: false,
            window: 0,
            unit: 'hours',
            key: '',
            keyType: '',
          }

    // Update store (draft or real)
    if (isDraftMode) {
      topicSelectionDraft.updateDraftTopic(index, topicData)
      topicSelectionDraft.updateDraftDeduplication(index, deduplicationData)
    } else {
      topicsStore.updateTopic(topicData)
      deduplicationStore.updateDeduplication(index, deduplicationData)
    }
  }, [
    index,
    topicName,
    offset,
    eventState.event,
    enableDeduplication,
    deduplicationConfigured,
    deduplicationConfig,
    storedDeduplicationConfig,
    isDraftMode,
    topicSelectionDraft,
    topicsStore,
    deduplicationStore,
  ])

  return {
    // State
    topicName,
    offset,
    event: eventState.event,
    isLoading: eventState.isLoading,
    isEmptyTopic: eventState.isEmptyTopic,
    error: eventState.error,
    deduplicationConfig,
    deduplicationConfigured,
    canContinue,
    isDraftMode,

    // Actions
    selectTopic: handleTopicChange,
    selectOffset: handleOffsetChange,
    configureDeduplication: handleDeduplicationConfigChange,
    submit: handleSubmit,
  }
}
