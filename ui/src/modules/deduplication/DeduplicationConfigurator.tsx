'use client'

import React, { useCallback, useEffect } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { EventPreview } from '@/src/components/shared/EventPreview'
import { parseForCodeEditor } from '@/src/utils'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export function DeduplicationConfigurator({
  onNext,
  index = 0,
}: {
  onNext: (stepName: string) => void
  index: number
}) {
  const analytics = useJourneyAnalytics()

  // Access the full topics array directly instead of using getter methods
  const { topics, updateTopic } = useStore((state) => state.topicsStore)

  // Get current topic directly from the array
  const topic = topics[index]

  // Get the event directly from the topic's events array
  const topicEvent = topic?.events?.[0] || null

  // Extract event data
  const eventData = topicEvent?.event?.event || topicEvent?.event || '{}'

  // Track page view when component loads
  useEffect(() => {
    analytics.page.deduplicationKey({})
  }, [])

  // Directly read the deduplication config from the topic
  const deduplicationConfig = topic?.deduplication || {
    enabled: false,
    window: '',
    unit: '',
    key: '',
    keyType: 'string',
  }

  // Determine if we can continue based directly on the store data
  const canContinue = !!(deduplicationConfig.key && deduplicationConfig.window && deduplicationConfig.unit)

  // Update the topic in the store directly without local state
  const handleDeduplicationConfigChange = useCallback(
    ({ key, keyType }: { key: string; keyType: string }, { window, unit }: { window: number; unit: string }) => {
      if (!topic) return

      // Create an updated deduplication config
      const updatedConfig = {
        enabled: true,
        index,
        window,
        unit: unit as 'seconds' | 'minutes' | 'hours' | 'days',
        key,
        keyType,
      }

      // Update the topic directly in the store
      updateTopic({
        ...topic,
        index,
        deduplication: updatedConfig,
      })

      analytics.key.dedupKey({
        keyType,
        window,
        unit,
      })
    },
    [topic, index, updateTopic],
  )

  // Handle continue button click
  const handleSave = useCallback(() => {
    if (!topic?.name) return
    onNext(StepKeys.DEDUPLICATION_CONFIGURATOR)
  }, [topic, onNext])

  if (!topic || !topicEvent) {
    return <div>No topic or event data available for index {index}</div>
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Topic Configuration */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-12 w-[40%]">
          {/* Force remounting of this component when the topic name changes */}
          <SelectDeduplicateKeys
            key={`dedup-keys-${topic.name}-${Date.now()}`}
            index={index}
            onChange={handleDeduplicationConfigChange}
            disabled={!topic?.name}
            eventData={eventData}
          />
        </div>
        <div className="w-[60%] min-h-[400px]">
          <EventPreview
            event={parseForCodeEditor(eventData)}
            topic={topic?.name}
            isLoadingEvent={false}
            eventError={''}
            handleRefreshEvent={() => {}}
            handleFetchPreviousEvent={() => {}}
            handleFetchNewestEvent={() => {}}
            handleFetchOldestEvent={() => {}}
            hasOlderEvents={false}
            showInternalNavigationButtons={false}
            eventPosition={0}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-start gap-4 mt-4">
        <Button
          onClick={handleSave}
          disabled={!canContinue}
          variant={canContinue ? 'gradient' : 'outline'}
          className={cn({
            'btn-primary': canContinue,
            'btn-text-disabled': !canContinue,
            'btn-text': canContinue,
          })}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

// const TrashControl = ({ onRemove, index }: { onRemove: () => void; index: number }) => {
//   return (
//     <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="h-8 w-8">
//       <TrashIcon className="h-4 w-4" />
//     </Button>
//   )
// }

// const AddKeyControl = ({ onAdd }: { onAdd: () => void }) => {
//   return (
//     <Button variant="outline" className="max-w-[150px] mt-2 btn-neutral" onClick={onAdd}>
//       Add Another Key
//     </Button>
//   )
// }
