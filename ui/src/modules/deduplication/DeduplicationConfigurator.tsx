'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { EventEditor } from '@/src/components/shared/EventEditor'
import { parseForCodeEditor } from '@/src/utils/common.client'
import { StepKeys } from '@/src/config/constants'
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
  pipelineActionState,
  onCompleteStandaloneEditing,
}: {
  onCompleteStep: (stepName: string) => void
  index: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}) {
  const analytics = useJourneyAnalytics()
  const validationEngine = useValidationEngine()
  const { coreStore } = useStore()

  // Use the new separated store structure with proper memoization
  const deduplicationConfig = useStore((state) => state.deduplicationStore.getDeduplication(index))
  const updateDeduplication = useStore((state) => state.deduplicationStore.updateDeduplication)

  // Get topic data for event information
  const topic = useStore((state) => state.topicsStore.getTopic(index))

  // Get the selected event from the topic
  // The event data is in topic.selectedEvent.event, not in topic.events array
  const selectedEvent = topic?.selectedEvent

  // Extract event data
  const eventData = selectedEvent?.event || null

  // Track page view when component loads
  useEffect(() => {
    analytics.page.deduplicationKey({})
  }, [])

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Reset success state when user starts editing again
  useEffect(() => {
    if (!readOnly && isSaveSuccess) {
      setIsSaveSuccess(false)
    }
  }, [readOnly, isSaveSuccess])

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

      // Note: Deduplication changes do NOT invalidate ClickHouse mapping
      // Deduplication settings (key, time window) are independent of field-to-column mappings
      // Only topic/event structure changes should invalidate the mapping

      analytics.key.dedupKey({
        keyType,
        window,
        unit,
      })
    },
    [index, updateDeduplication, analytics.key],
  )

  // Handle continue button click
  const handleSave = useCallback(() => {
    if (!topic?.name) return

    // Trigger validation engine to mark this section as valid and invalidate dependents
    validationEngine.onSectionConfigured(StepKeys.DEDUPLICATION_CONFIGURATOR)

    // Check if we're in edit mode (standalone with toggleEditMode)
    const isEditMode = standalone && toggleEditMode

    if (isEditMode) {
      // In edit mode, just save changes and stay in the same section
      // Don't call onCompleteStep as we want to stay in the same section
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing?.()
      // Don't reset success state - let it stay true to keep the form closed
      // The success state will be reset when the user starts editing again
    } else {
      // In creation mode, move to next step
      onCompleteStep(StepKeys.DEDUPLICATION_CONFIGURATOR as StepKeys)
    }
  }, [topic, onCompleteStep, validationEngine, standalone, toggleEditMode])

  // Handle discard changes for deduplication configuration
  const handleDiscardChanges = useCallback(() => {
    // Discard deduplication section
    coreStore.discardSection('deduplication')
  }, [coreStore])

  // Show error message if topic or event data is missing
  if (!topic) {
    return <div>No topic data available for index {index}</div>
  }

  if (!eventData) {
    return (
      <div>
        No event data available for topic &quot;{topic.name}&quot;. Please ensure the topic has been configured with
        event data.
      </div>
    )
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
        onDiscard={handleDiscardChanges}
        isLoading={false}
        isSuccess={isSaveSuccess}
        disabled={!canContinue}
        successText="Continue"
        loadingText="Loading..."
        regularText="Continue"
        actionType="primary"
        showLoadingIcon={false}
        readOnly={readOnly}
        toggleEditMode={toggleEditMode}
        pipelineActionState={pipelineActionState}
        onClose={onCompleteStandaloneEditing}
      />
    </div>
  )
}
