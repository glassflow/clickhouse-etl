'use client'

import React, { useCallback, useEffect } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { EventEditor } from '@/src/components/shared/EventEditor'
import { parseForCodeEditor } from '@/src/utils/common.client'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import FormActions from '@/src/components/shared/FormActions'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'

export function DeduplicationConfigurator({
  onCompleteStep,
  index = 0,
  readOnly,
  standalone,
  toggleEditMode,
}: {
  onCompleteStep: (stepName: string) => void
  index: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
}) {
  const analytics = useJourneyAnalytics()
  const validationEngine = useValidationEngine()

  // Use the new separated store structure with proper memoization
  const deduplicationConfig = useStore((state) => state.deduplicationStore.getDeduplication(index))
  const updateDeduplication = useStore((state) => state.deduplicationStore.updateDeduplication)

  // Get topic data for event information
  const topic = useStore((state) => state.topicsStore.getTopic(index))

  // Get the event directly from the topic's events array
  const topicEvent = topic?.events?.[0] || null

  // Extract event data
  const eventData = topicEvent?.event || '{}'

  // Track page view when component loads
  useEffect(() => {
    analytics.page.deduplicationKey({})
  }, [])

  // Use deduplication config from the new store, with fallback
  const currentDeduplicationConfig = deduplicationConfig || {
    enabled: false,
    window: 0,
    unit: 'hours',
    key: '',
    keyType: 'string',
  }

  // Determine if we can continue based directly on the store data
  const canContinue = !!(
    currentDeduplicationConfig.key &&
    currentDeduplicationConfig.window &&
    currentDeduplicationConfig.unit
  )

  // Update the deduplication config in the new store
  const handleDeduplicationConfigChange = useCallback(
    ({ key, keyType }: { key: string; keyType: string }, { window, unit }: { window: number; unit: string }) => {
      // Create an updated deduplication config
      const updatedConfig = {
        enabled: true,
        window,
        unit: unit as 'seconds' | 'minutes' | 'hours' | 'days',
        key,
        keyType,
      }

      // Update the deduplication config in the new store
      updateDeduplication(index, updatedConfig)

      analytics.key.dedupKey({
        keyType,
        window,
        unit,
      })
    },
    [index, updateDeduplication],
  )

  // Handle continue button click
  const handleSave = useCallback(() => {
    if (!topic?.name) return

    // Trigger validation engine to mark this section as valid and invalidate dependents
    validationEngine.onSectionConfigured(StepKeys.DEDUPLICATION_CONFIGURATOR)

    onCompleteStep(StepKeys.DEDUPLICATION_CONFIGURATOR as StepKeys)
  }, [topic, onCompleteStep, validationEngine])

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
            readOnly={readOnly}
          />
        </div>
        <div className="w-[60%] min-h-[400px]">
          <EventEditor
            event={parseForCodeEditor(eventData)}
            topic={topic?.name}
            isLoadingEvent={false}
            eventError={''}
            isEmptyTopic={false}
            onManualEventChange={() => {}}
            isEditingEnabled={false}
            readOnly={readOnly}
          />
        </div>
      </div>

      <FormActions
        standalone={standalone}
        onSubmit={handleSave}
        isLoading={false}
        isSuccess={false}
        disabled={!canContinue}
        successText="Continue"
        loadingText="Loading..."
        regularText="Continue"
        actionType="primary"
        showLoadingIcon={false}
        readOnly={readOnly}
        toggleEditMode={toggleEditMode}
      />
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
