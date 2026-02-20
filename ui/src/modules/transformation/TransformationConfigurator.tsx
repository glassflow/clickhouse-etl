'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import FormActions from '@/src/components/shared/FormActions'
import { isFieldComplete } from '@/src/store/transformation.store'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { buildEffectiveEvent, getSchemaModifications, type SchemaField } from '@/src/utils/common.client'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import type { ApiValidationStatus } from './hooks/useTransformationActions'

// Hooks
import { useAvailableFields } from './hooks/useAvailableFields'
import { useTransformationValidation } from './hooks/useTransformationValidation'
import { useTransformationActions } from './hooks/useTransformationActions'

// Components
import { SchemaModificationNotice } from './components/SchemaModificationNotice'
import { NoTransformationView } from './components/NoTransformationView'
import { TransformationFieldList } from './components/TransformationFieldList'
import { IntermediarySchemaPreview } from './components/IntermediarySchemaPreview'

export interface TransformationConfiguratorProps {
  onCompleteStep: (stepName: string) => void
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}

export function TransformationConfigurator({
  onCompleteStep,
  readOnly = false,
  standalone = false,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: TransformationConfiguratorProps) {
  // Store access
  const { coreStore, transformationStore, topicsStore } = useStore()
  const validationEngine = useValidationEngine()

  // Get transformation config from store
  const transformationConfig = transformationStore.transformationConfig

  // Get topic data for available fields
  const topic = topicsStore.getTopic(0) // Transformation applies to the first topic
  const selectedEvent = topic?.selectedEvent
  const eventData = selectedEvent?.event?.event || selectedEvent?.event

  // Get schema fields from KafkaTypeVerification step (if configured)
  const schemaFields = (topic as any)?.schema?.fields as SchemaField[] | undefined

  // Build effective event that reflects schema modifications (added/removed fields)
  const effectiveEventData = useMemo(() => {
    return buildEffectiveEvent(eventData, schemaFields)
  }, [eventData, schemaFields])

  // Get schema modification info for displaying notices
  const schemaModifications = useMemo(() => {
    return getSchemaModifications(schemaFields)
  }, [schemaFields])

  // Custom hook for available fields derivation
  const availableFields = useAvailableFields(schemaFields, effectiveEventData, transformationConfig.fields)

  // Custom hook for validation state management
  const validation = useTransformationValidation(transformationConfig, transformationStore)

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Track if auto-population has been attempted (to prevent re-triggering)
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false)

  // API validation state (evaluate endpoint)
  const [apiValidation, setApiValidationState] = useState<{
    status: ApiValidationStatus
    error?: string
  }>({ status: 'idle' })
  const setApiValidation = useCallback((state: { status: ApiValidationStatus; error?: string }) => {
    setApiValidationState(state)
  }, [])

  // Sample for API validation: effective event from first topic (must be loaded in Kafka step)
  const sampleForValidation = useMemo(() => {
    if (effectiveEventData == null || typeof effectiveEventData !== 'object') return null
    if (Object.keys(effectiveEventData).length === 0) return null
    return effectiveEventData as Record<string, unknown>
  }, [effectiveEventData])

  const apiValidationOption = useMemo(
    () => ({ sample: sampleForValidation, setApiValidation }),
    [sampleForValidation, setApiValidation],
  )

  // Custom hook for action handlers
  const actions = useTransformationActions(
    { transformationStore, validationEngine, coreStore },
    transformationConfig,
    availableFields,
    { readOnly, standalone, onCompleteStep, onCompleteStandaloneEditing },
    { setSaveAttempted: validation.setSaveAttempted, setLocalValidation: validation.setLocalValidation },
    setIsSaveSuccess,
    setHasAutoPopulated,
    apiValidationOption,
  )

  // Auto-populate fields from Kafka schema if not already configured
  // This runs once when entering the step with available fields but no existing config
  useEffect(() => {
    // Don't auto-populate if:
    // - Already auto-populated in this session
    // - In read-only mode (viewing existing pipeline)
    // - In standalone mode (editing existing pipeline)
    // - No available fields from Kafka schema
    // - Already has transformation fields configured (e.g., from hydration)
    if (
      hasAutoPopulated ||
      readOnly ||
      standalone ||
      availableFields.length === 0 ||
      transformationConfig.fields.length > 0 ||
      transformationConfig.enabled
    ) {
      return
    }

    // Auto-populate all fields as pass-through
    transformationStore.addAllFieldsAsPassthrough(availableFields)
    setHasAutoPopulated(true)
  }, [
    availableFields,
    hasAutoPopulated,
    readOnly,
    standalone,
    transformationConfig.fields.length,
    transformationConfig.enabled,
    transformationStore,
  ])

  // Derived state
  const completeFieldCount = transformationConfig.fields.filter(isFieldComplete).length
  const totalFieldCount = transformationConfig.fields.length

  // Check if we can continue - button should ALWAYS be clickable so users can see validation errors
  // The handleSave function will validate and prevent saving if invalid
  const canContinue = useMemo(() => {
    // Only disable the button when there are no fields to save (empty state)
    // When there ARE fields, allow clicking to trigger validation and show errors
    if (!transformationConfig.enabled || transformationConfig.fields.length === 0) {
      return true // Can skip transformation (will pass all fields unchanged)
    }
    // Always allow clicking when there are fields - validation happens on click
    return true
  }, [transformationConfig])

  // Check if transformation is configured (has fields)
  const hasNoTransformation = !transformationConfig.enabled && transformationConfig.fields.length === 0

  // Determine if we should show the field list
  const showFieldList =
    (availableFields.length > 0 || transformationConfig.fields.length > 0) &&
    (!readOnly || transformationConfig.fields.length > 0)

  // Determine if we should show the schema preview
  const showSchemaPreview = transformationConfig.fields.length > 0 && completeFieldCount > 0

  // Show API validation status when transformation is enabled and has fields
  const showApiValidation =
    !readOnly &&
    transformationConfig.enabled &&
    transformationConfig.fields.length > 0 &&
    completeFieldCount > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Schema modification notice */}
      <SchemaModificationNotice schemaModifications={schemaModifications} />

      {/* Header with Description */}
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm text-content-faded flex-1">
          {availableFields.length > 0
            ? transformationConfig.fields.length > 0
              ? "All fields from your Kafka event have been added as pass-through fields. Remove fields you don't need, convert them to computed transformations, or add new fields."
              : 'Define transformations to create computed fields or pass through existing fields. The resulting schema will be used for mapping to ClickHouse.'
            : 'Select a topic and verify field types to configure transformations.'}
        </div>
      </div>

      {/* Show no transformation view if empty and in read-only mode */}
      {hasNoTransformation && readOnly && (
        <NoTransformationView readOnly={readOnly} hasAvailableFields={availableFields.length > 0} />
      )}

      {/* Skip button - prominently placed at top */}
      {!standalone && !readOnly && availableFields.length > 0 && (
        <div className="flex justify-start items-center">
          <Button
            variant="outline"
            onClick={actions.handleSkip}
            className="flex-shrink-0 border-dashed hover:border-solid btn-tertiary text-primary hover:text-primary-faded"
          >
            Skip Transformation
          </Button>

          <span className="ml-2 text-xs text-primary">(pass all fields unchanged)</span>
        </div>
      )}

      {/* Transformation Fields List */}
      {showFieldList && (
        <TransformationFieldList
          fields={transformationConfig.fields}
          availableFields={availableFields}
          fieldErrors={validation.localValidation.fieldErrors}
          readOnly={readOnly}
          completeFieldCount={completeFieldCount}
          totalFieldCount={totalFieldCount}
          onUpdate={actions.handleUpdateField}
          onRemove={actions.handleRemoveField}
          onClearAll={actions.handleClearAllFields}
          onRestoreSourceFields={actions.handleRestoreSourceFields}
          onAddField={actions.handleAddPassthroughField}
        />
      )}

      {/* Intermediary Schema Preview */}
      {showFieldList && showSchemaPreview && (
        <IntermediarySchemaPreview
          config={transformationConfig}
          validation={validation.localValidation}
          saveAttempted={validation.saveAttempted}
          validationErrorDetails={validation.validationErrorDetails}
          totalErrorCount={validation.totalErrorCount}
          isValidationExpanded={validation.isValidationExpanded}
          onToggleValidationExpanded={() => validation.setIsValidationExpanded((prev) => !prev)}
        />
      )}

      {/* Global validation errors (outside field list) */}
      {showFieldList && validation.localValidation.globalErrors.length > 0 && (
        <div className="text-sm text-[var(--color-foreground-critical)]">
          {validation.localValidation.globalErrors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}

      {/* API validation status (evaluate endpoint) */}
      {showApiValidation && (
        <div className="flex flex-col gap-1">
          {apiValidation.status === 'validating' && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <div className="w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />
              Validating expression...
            </div>
          )}
          {apiValidation.status === 'valid' && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-positive)]">
              <CheckCircleIcon className="w-4 h-4" />
              Valid expression
            </div>
          )}
          {apiValidation.status === 'invalid' && apiValidation.error && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-critical)]">
              <XCircleIcon className="w-4 h-4 flex-shrink-0" />
              <span>{apiValidation.error}</span>
            </div>
          )}
        </div>
      )}

      {/* No sample event message */}
      {!readOnly &&
        transformationConfig.enabled &&
        transformationConfig.fields.length > 0 &&
        completeFieldCount > 0 &&
        sampleForValidation == null && (
          <div className="text-sm text-[var(--text-secondary)]">
            Load a sample event in the previous step to validate expressions.
          </div>
        )}

      {/* No fields available message */}
      {!readOnly && availableFields.length === 0 && hasNoTransformation && (
        <div className="p-4 card-outline rounded-[var(--radius-xl)] text-center text-[var(--text-secondary)]">
          <p>Waiting for field type verification to configure transformations...</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 items-center">
        <FormActions
          standalone={standalone}
          onSubmit={actions.handleSave}
          onDiscard={actions.handleDiscardChanges}
          isLoading={apiValidation.status === 'validating'}
          isSuccess={isSaveSuccess}
          disabled={!canContinue}
          successText="Save Transformation"
          loadingText="Validating..."
          regularText="Save Transformation"
          actionType="primary"
          showLoadingIcon={false}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
        />

        {/* Skip button - prominently placed at top */}
        {!standalone && !readOnly && availableFields.length > 0 && (
          <div className="flex justify-start items-center">
            <Button
              variant="outline"
              onClick={actions.handleSkip}
              className="flex-shrink-0 border-dashed hover:border-solid btn-tertiary text-primary hover:text-primary-faded"
            >
              Skip Transformation
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TransformationConfigurator
