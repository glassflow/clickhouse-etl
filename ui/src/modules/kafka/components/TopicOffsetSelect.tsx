import { useState, useCallback } from 'react'
import { TopicSelect } from '@/src/modules/kafka/components/TopicSelect'
import { OffsetSelect } from '@/src/components/shared/OffsetSelect'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'

export function TopicOffsetSelect({
  topicValue,
  isLoadingEvent,
  offsetValue,
  onTopicChange,
  onOffsetChange,
  onBlur,
  onOpenChange,
  topicError,
  offsetError,
  topicPlaceholder,
  offsetPlaceholder,
  topicOptions,
  offsetOptions,
  index,
  readOnly,
  disableTopicChange, // ✅ NEW: Specifically disable topic selection
  onRefreshTopics,
}: {
  topicValue: string
  isLoadingEvent: boolean
  offsetValue: 'earliest' | 'latest'
  onTopicChange: (value: string) => void
  onOffsetChange: (value: 'earliest' | 'latest') => void
  onBlur: () => void
  onOpenChange: (open: boolean) => void
  topicError: string
  offsetError: string
  topicPlaceholder: string
  offsetPlaceholder: string
  topicOptions: { label: string; value: string }[]
  offsetOptions: { label: string; value: 'earliest' | 'latest' }[]
  index: number
  readOnly?: boolean
  disableTopicChange?: boolean // ✅ NEW: Specifically disable topic selection in edit mode
  onRefreshTopics?: () => Promise<void>
}) {
  const [isFocused, setIsFocused] = useState(false)
  const { topicsStore } = useStore()
  const { updateTopic } = topicsStore

  // Enhanced topic change handler with state management
  const handleTopicChange = useCallback(
    (value: string) => {
      // Call the original handler
      onTopicChange(value)

      // Additional state management
      if (value !== topicValue) {
        // Note: We don't invalidate dependent state here anymore
        // The smart invalidation logic in handleSubmit will determine if invalidation is needed
        // based on schema comparison (topic name change + schema change = invalidate)
        // This prevents unnecessary invalidation when topic changes but schema is the same

        // Clear previous events when topic changes - we'll fetch new ones
        updateTopic({
          index: index,
          name: value,
          initialOffset: offsetValue,
          events: [], // Reset events array
          selectedEvent: {
            topicIndex: index,
            position: offsetValue,
            event: undefined,
          },
        })
      }
    },
    [topicValue, offsetValue, index, onTopicChange, updateTopic],
  )

  // Enhanced offset change handler
  const handleOffsetChange = useCallback(
    (value: 'earliest' | 'latest') => {
      // Call the original handler
      onOffsetChange(value)

      // Additional state management if needed
      if (value !== offsetValue) {
        // Update topic with new offset
        updateTopic({
          index: index,
          name: topicValue,
          initialOffset: value,
          events: [], // Reset events array
          selectedEvent: {
            topicIndex: index,
            position: value,
            event: undefined,
          },
        })

        // Force a re-render of the EventManager by clearing the current event
        // This will trigger the useEffect in EventManager
        if (topicValue) {
          updateTopic({
            index: index,
            name: topicValue,
            initialOffset: value,
            events: [],
            selectedEvent: {
              topicIndex: index,
              position: value,
              event: undefined,
            },
          })
        }
      }
    },
    [topicValue, offsetValue, index, onOffsetChange, updateTopic],
  )

  return (
    <div className="flex flex-col gap-4">
      <TopicSelect
        value={topicValue}
        onChange={handleTopicChange}
        onBlur={onBlur}
        onOpenChange={onOpenChange}
        error={topicError}
        placeholder={topicPlaceholder}
        options={topicOptions}
        readOnly={disableTopicChange || readOnly} // ✅ Topic is disabled if in edit mode OR readOnly
        label="Source Topic"
        onRefresh={onRefreshTopics}
        // ✅ Show tooltip when topic change is disabled in edit mode
        {...(disableTopicChange && !readOnly
          ? {
              title:
                'Topic cannot be changed when editing a pipeline. To use a different topic, create a new pipeline.',
            }
          : {})}
      />
      {topicValue && (
        <OffsetSelect
          value={offsetValue}
          onChange={handleOffsetChange}
          onBlur={onBlur}
          onOpenChange={onOpenChange}
          error={offsetError}
          placeholder={offsetPlaceholder}
          options={offsetOptions}
          readOnly={readOnly || isLoadingEvent} // ✅ Offset can still be changed in edit mode
          label="Initial Offset"
        />
      )}
    </div>
  )
}
