'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { StepKeys, JSON_DATA_TYPES } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import type { PipelineActionState } from '@/src/modules/kafka/types'
import { useTypeVerificationState } from '@/src/modules/kafka/hooks/useTypeVerificationState'
import { FieldTypesTable } from '@/src/modules/kafka/components/FieldTypesTable'
import { isRegistrySchema } from '@/src/modules/kafka/utils/schemaSource'

export interface KafkaTypeVerificationProps {
  onCompleteStep: (stepName: string) => void
  index?: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: PipelineActionState
  onCompleteStandaloneEditing?: () => void
}

export function KafkaTypeVerification({
  onCompleteStep,
  index = 0,
  readOnly = false,
  standalone = false,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: KafkaTypeVerificationProps) {
  const validationEngine = useValidationEngine()
  const { coreStore, topicsStore } = useStore()

  const topic = topicsStore.getTopic(index)
  const selectedEvent = topic?.selectedEvent
  const eventData = selectedEvent?.event || null
  const isExternalSchema = isRegistrySchema(topic?.schemaSource)

  const {
    fieldTypes,
    newFieldName,
    newFieldType,
    newFieldError,
    setNewFieldName,
    setNewFieldType,
    clearNewFieldError,
    handleTypeChange,
    handleAddField,
    handleRemoveField,
    handleRestoreField,
    canContinue,
  } = useTypeVerificationState({ eventData: isExternalSchema ? null : eventData, topic })

  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  const handleSave = useCallback(() => {
    if (!topic?.name) return

    const schema = {
      fields: fieldTypes.map((f) => ({
        name: f.name,
        type: f.userType,
        inferredType: f.inferredType,
        userType: f.userType,
        isManuallyAdded: f.isManuallyAdded,
        isRemoved: f.isRemoved,
      })),
    }

    topicsStore.updateTopic({
      ...topic,
      schema,
    })

    validationEngine.onSectionConfigured(StepKeys.KAFKA_TYPE_VERIFICATION)

    if (standalone && toggleEditMode) {
      coreStore.markAsDirty()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing?.()
    } else {
      onCompleteStep(StepKeys.KAFKA_TYPE_VERIFICATION)
    }
  }, [
    topic,
    fieldTypes,
    topicsStore,
    validationEngine,
    standalone,
    toggleEditMode,
    coreStore,
    onCompleteStandaloneEditing,
    onCompleteStep,
  ])

  const handleDiscardChanges = useCallback(() => {
    coreStore.discardSection('topics')
  }, [coreStore])

  useEffect(() => {
    if (!readOnly && isSaveSuccess) {
      setIsSaveSuccess(false)
    }
  }, [readOnly, isSaveSuccess])

  if (!topic) {
    return <div className="text-[var(--text-secondary)]">No topic data available. Please select a topic first.</div>
  }

  if (!isExternalSchema && !eventData) {
    return (
      <div className="text-[var(--text-secondary)]">
        No event data available for topic &quot;{topic.name}&quot;. Please ensure the topic has events.
      </div>
    )
  }

  // For external schema: use the registry fields directly
  const externalFields: typeof fieldTypes = isExternalSchema
    ? (topic.schema?.fields || []).map((f) => ({
        name: f.name,
        inferredType: f.type,
        userType: f.userType || f.type,
        isManuallyAdded: false,
        isRemoved: false,
      }))
    : []

  const displayFields = isExternalSchema ? externalFields : fieldTypes
  const canSubmit = isExternalSchema ? externalFields.length > 0 : canContinue

  return (
    <div className="flex flex-col gap-6">
      {isExternalSchema ? (
        <div className="rounded-md border border-border bg-background-neutral-faded px-4 py-3 text-sm text-content">
          <strong>Schema loaded from Schema Registry</strong>
          {topic.schemaRegistrySubject && (
            <span className="ml-2 text-content-faded">
              Subject: {topic.schemaRegistrySubject}
              {topic.schemaRegistryVersion && ` · Version: ${topic.schemaRegistryVersion}`}
            </span>
          )}
          <div className="mt-1 text-content-faded">
            Fields are read-only. To change the schema, update the subject on the Topic Selection step.
          </div>
        </div>
      ) : (
        <div className="text-content-faded text-sm">
          Review and customize the schema for your Kafka events. You can verify inferred types, add new fields, or
          remove fields you don&apos;t need. This schema will be used for transformations and mapping to ClickHouse.
        </div>
      )}

      <div className="flex gap-4 w-full">
        <FieldTypesTable
          fieldTypes={displayFields}
          readOnly={readOnly || isExternalSchema}
          dataTypes={JSON_DATA_TYPES}
          onTypeChange={handleTypeChange}
          onRemoveField={handleRemoveField}
          onRestoreField={handleRestoreField}
          newFieldName={newFieldName}
          newFieldType={newFieldType}
          newFieldError={newFieldError}
          onNewFieldNameChange={setNewFieldName}
          onNewFieldTypeChange={setNewFieldType}
          onNewFieldErrorClear={clearNewFieldError}
          onAddField={handleAddField}
        />
      </div>

      <div className="flex gap-4 items-center">
        <FormActions
          standalone={standalone}
          onSubmit={handleSave}
          onDiscard={handleDiscardChanges}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={!canSubmit}
          successText="Continue"
          loadingText="Saving..."
          regularText={isExternalSchema ? 'Confirm Schema' : 'Confirm Types'}
          actionType="primary"
          showLoadingIcon={false}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
        />
      </div>
    </div>
  )
}

export default KafkaTypeVerification
