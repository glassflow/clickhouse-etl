'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { EventPreview } from '@/src/components/wizard/EventPreview'
import { parseForCodeEditor } from '@/src/utils'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { TrashIcon } from '@heroicons/react/24/outline'
import SelectDeduplicateKeys from '@/src/components/SelectDeduplicateKeys'

export function DeduplicationConfigurator({
  onNext,
  index = 0,
}: {
  onNext: (stepName: string) => void
  index: number
}) {
  // Local state to manage form before submitting to parent
  const [keyConfig, setKeyConfig] = useState({
    key: '',
    keyType: 'string',
  })
  const [windowConfig, setWindowConfig] = useState({
    window: '',
    unit: '',
  })
  const [canContinue, setCanContinue] = useState(false)

  const { topicsStore } = useStore()
  const { getTopic, getEvent, updateTopic } = topicsStore

  const topic = getTopic(index)
  const topicEvent = getEvent(index, 0)

  // Extract keys from the event - fix to go one level deeper in the event structure
  // The event data is nested inside topicEvent.event.event
  const eventData = topicEvent?.event?.event || topicEvent?.event || '{}'

  // Update validation state whenever configs change
  useEffect(() => {
    setCanContinue(!!keyConfig.key && !!windowConfig.window && !!windowConfig.unit)
  }, [keyConfig, windowConfig])

  // Initialize from existing deduplication config if available
  useEffect(() => {
    if (topic?.deduplication) {
      const { window, unit, key, keyType } = topic.deduplication
      if (window && unit) {
        setWindowConfig({
          window: window.toString(),
          unit,
        })
      }
      if (key) {
        setKeyConfig({
          key,
          keyType: keyType || 'string',
        })
      }
    }
  }, [topic])

  // Update parent form data when configurations change
  const handleSave = useCallback(() => {
    if (!topic?.name) return

    // Create config for topic
    const topicConfig = {
      enabled: true,
      index,
      window: parseInt(windowConfig.window),
      unit: windowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      key: keyConfig.key,
      keyType: keyConfig.keyType,
    }

    // Update topic in store
    updateTopic({
      ...topic,
      index,
      deduplication: topicConfig,
    })

    onNext(StepKeys.DEDUPLICATION_CONFIGURATOR)
  }, [keyConfig, windowConfig, topic, index, updateTopic, onNext])

  const handleDeduplicationConfigChange = useCallback(
    ({ key, keyType }: { key: string; keyType: string }, { window, unit }: { window: number; unit: string }) => {
      setKeyConfig({ key, keyType })
      setWindowConfig({ window: window.toString(), unit })
    },
    [],
  )

  if (!topic || !topicEvent) {
    return <div>No topic or event data available for index {index}</div>
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Topic Configuration */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-12 w-[40%]">
          <SelectDeduplicateKeys
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

      {/* Debug Info */}
      {/* <div className="text-xs text-gray-500">
        <div>Key: {keyConfig.key || 'Not set'}</div>
        <div>Key Type: {keyConfig.keyType || 'Not set'}</div>
        <div>Window: {windowConfig.window || 'Not set'}</div>
        <div>Unit: {windowConfig.unit || 'Not set'}</div>
        <div>Can Continue: {canContinue ? 'Yes' : 'No'}</div>
      </div> */}

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
