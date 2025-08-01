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
}) {
  const [isFocused, setIsFocused] = useState(false)
  const { topicsStore, joinStore } = useStore()
  const { invalidateTopicDependentState, updateTopic } = topicsStore

  // Enhanced topic change handler with state management
  const handleTopicChange = useCallback(
    (value: string) => {
      // Call the original handler
      onTopicChange(value)

      // Additional state management
      if (value !== topicValue) {
        // Invalidate dependent state
        invalidateTopicDependentState(index)

        // Clear join store configuration
        joinStore.setEnabled(false)
        joinStore.setType('')
        joinStore.setStreams([])

        // Clear previous events when topic changes
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
    [topicValue, offsetValue, index, onTopicChange, invalidateTopicDependentState, joinStore, updateTopic],
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
        readOnly={readOnly}
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
          readOnly={readOnly || isLoadingEvent}
        />
      )}
    </div>
  )
}
