'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { CheckCircleIcon, XCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { StepKeys } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { TransformationFieldRow } from './components/TransformationFieldRow'
import { TransformationField, isFieldComplete } from '@/src/store/transformation.store'
import {
  toTransformationExpr,
  validateTransformationConfig,
  TransformationConfigValidation,
  getIntermediarySchema,
} from './utils'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'

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
  const { coreStore, transformationStore, topicsStore } = useStore()
  const validationEngine = useValidationEngine()

  // Get transformation config from store
  const transformationConfig = transformationStore.transformationConfig

  // Get topic data for available fields
  const topic = topicsStore.getTopic(0) // Transformation applies to the first topic
  const selectedEvent = topic?.selectedEvent
  const schema = (topic as any)?.schema?.fields || []

  // Extract available fields from verified schema
  const availableFields = useMemo((): Array<{ name: string; type: string }> => {
    if (schema && schema.length > 0) {
      return schema.map((f: any) => ({
        name: f.name,
        type: f.userType || f.type,
      }))
    }
    return []
  }, [schema])

  // Local validation state
  const [localValidation, setLocalValidation] = useState<TransformationConfigValidation>({
    isValid: true,
    fieldErrors: {},
    globalErrors: [],
  })

  // Track if save has been attempted
  const [saveAttempted, setSaveAttempted] = useState(false)

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Validate configuration when it changes
  useEffect(() => {
    const validation = validateTransformationConfig(transformationConfig)

    // Only show errors if save was attempted
    if (saveAttempted) {
      setLocalValidation(validation)
    } else {
      setLocalValidation({
        isValid: validation.isValid,
        fieldErrors: {},
        globalErrors: [],
      })
    }

    // Generate expression string
    if (transformationConfig.enabled && transformationConfig.fields.length > 0) {
      const expression = toTransformationExpr(transformationConfig)
      transformationStore.setExpressionString(expression)
    }
  }, [transformationConfig, saveAttempted])

  // Add new passthrough field
  const handleAddPassthroughField = useCallback(() => {
    transformationStore.addField({ type: 'passthrough' })
  }, [transformationStore])

  // Add new computed field
  const handleAddComputedField = useCallback(() => {
    transformationStore.addField({ type: 'computed' })
  }, [transformationStore])

  // Update a field
  const handleUpdateField = useCallback(
    (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => {
      transformationStore.updateField(fieldId, updates)
    },
    [transformationStore],
  )

  // Remove a field
  const handleRemoveField = useCallback(
    (fieldId: string) => {
      transformationStore.removeField(fieldId)
    },
    [transformationStore],
  )

  // Skip transformation
  const handleSkip = useCallback(() => {
    transformationStore.skipTransformation()
    validationEngine.onSectionConfigured(StepKeys.TRANSFORMATION_CONFIGURATOR)
    onCompleteStep(StepKeys.TRANSFORMATION_CONFIGURATOR)
  }, [transformationStore, validationEngine, onCompleteStep])

  // Save and continue
  const handleSave = useCallback(() => {
    setSaveAttempted(true)

    // Validate
    const validation = validateTransformationConfig(transformationConfig)
    setLocalValidation(validation)

    if (!validation.isValid) {
      return
    }

    // Generate final expression
    const expression = toTransformationExpr(transformationConfig)
    transformationStore.setExpressionString(expression)

    // Mark section as valid
    validationEngine.onSectionConfigured(StepKeys.TRANSFORMATION_CONFIGURATOR)

    if (standalone && onCompleteStandaloneEditing) {
      coreStore.markAsDirty()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing()
    } else {
      onCompleteStep(StepKeys.TRANSFORMATION_CONFIGURATOR)
    }
  }, [
    transformationConfig,
    transformationStore,
    validationEngine,
    standalone,
    onCompleteStandaloneEditing,
    onCompleteStep,
    coreStore,
  ])

  // Discard changes
  const handleDiscardChanges = useCallback(() => {
    transformationStore.resetTransformationStore()
  }, [transformationStore])

  // Check if we can continue
  const canContinue = useMemo(() => {
    if (!transformationConfig.enabled || transformationConfig.fields.length === 0) {
      return true // Can skip transformation
    }
    return localValidation.isValid
  }, [transformationConfig, localValidation])

  // Get complete field count
  const completeFieldCount = transformationConfig.fields.filter(isFieldComplete).length
  const totalFieldCount = transformationConfig.fields.length

  // Check if transformation is configured (has fields)
  const hasNoTransformation = !transformationConfig.enabled && transformationConfig.fields.length === 0

  // Render no transformation view
  const renderNoTransformationView = () => (
    <div className="space-y-4">
      <div className="p-6 card-outline rounded-[var(--radius-large)] text-center">
        <div className="text-[var(--color-foreground-neutral-faded)] mb-2">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
            />
          </svg>
          <p className="text-lg font-medium">No Transformations Configured</p>
          <p className="text-sm mt-1">All fields will be passed through unchanged to the mapping step.</p>
        </div>
        {!readOnly && availableFields.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)] mt-4">
            Click the buttons below to add computed or passthrough fields.
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div className="text-sm text-content">
        {availableFields.length > 0
          ? 'Define transformations to create computed fields or pass through existing fields. The resulting schema will be used for mapping to ClickHouse.'
          : 'Select a topic and verify field types to configure transformations.'}
      </div>

      {/* Show no transformation view if empty and in read-only mode */}
      {hasNoTransformation && readOnly && renderNoTransformationView()}

      {/* Transformation Fields */}
      {availableFields.length > 0 && (!readOnly || transformationConfig.fields.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-medium text-content">
              Transformation Fields
              {totalFieldCount > 0 && (
                <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
                  ({completeFieldCount}/{totalFieldCount} complete)
                </span>
              )}
            </Label>

            {!readOnly && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleAddPassthroughField} className="btn-tertiary">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Pass Through Field
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddComputedField} className="btn-tertiary">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Computed Field
                </Button>
              </div>
            )}
          </div>

          {/* Field List */}
          {transformationConfig.fields.length === 0 ? (
            <div className="text-sm text-[var(--text-secondary)] text-center py-8 border border-dashed border-[var(--surface-border)] rounded-[var(--radius-medium)]">
              No transformation fields yet. Click the buttons above to add fields.
            </div>
          ) : (
            <div className="space-y-3">
              {transformationConfig.fields.map((field, index) => (
                <TransformationFieldRow
                  key={field.id}
                  field={field}
                  availableFields={availableFields}
                  onUpdate={handleUpdateField}
                  onRemove={handleRemoveField}
                  errors={localValidation.fieldErrors[field.id]}
                  readOnly={readOnly}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Expression Preview */}
          {transformationConfig.fields.length > 0 && completeFieldCount > 0 && (
            <div className="mt-6 p-4 card-outline rounded-[var(--radius-large)] space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[var(--text-secondary)]">Intermediary Schema Preview</Label>
                {localValidation.isValid ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-positive)]">
                    <CheckCircleIcon className="w-4 h-4" />
                    Valid configuration
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-critical)]">
                    <XCircleIcon className="w-4 h-4" />
                    Invalid configuration
                  </div>
                )}
              </div>
              <div className="text-sm font-mono p-3 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)] border border-[var(--surface-border)]">
                {getIntermediarySchema(transformationConfig).map((field, idx) => (
                  <div key={idx} className="text-[var(--text-primary)]">
                    <span className="text-[var(--color-foreground-primary)]">{field.name}</span>
                    <span className="text-[var(--text-secondary)]">: {field.type}</span>
                    {field.sourceField && (
                      <span className="text-[var(--text-secondary)]"> (from {field.sourceField})</span>
                    )}
                    {field.functionName && (
                      <span className="text-[var(--text-secondary)]"> (computed via {field.functionName})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global validation errors */}
          {localValidation.globalErrors.length > 0 && (
            <div className="text-sm text-[var(--color-foreground-critical)]">
              {localValidation.globalErrors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No fields available message */}
      {!readOnly && availableFields.length === 0 && hasNoTransformation && (
        <div className="p-4 card-outline rounded-[var(--radius-large)] text-center text-[var(--text-secondary)]">
          <p>Waiting for field type verification to configure transformations...</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 items-center">
        {/* Skip button - only shown in creation mode */}
        {!standalone && (
          <Button variant="outline" onClick={handleSkip} className="btn-tertiary">
            Skip Transformation
          </Button>
        )}

        <FormActions
          standalone={standalone}
          onSubmit={handleSave}
          onDiscard={handleDiscardChanges}
          isLoading={false}
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
      </div>
    </div>
  )
}

export default TransformationConfigurator
