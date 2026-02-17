'use client'

import { useCallback } from 'react'
import { TransformationField, TransformationConfig } from '@/src/store/transformation.store'
import { StepKeys } from '@/src/config/constants'
import {
  validateTransformationConfig,
  toTransformationExpr,
  TransformationConfigValidation,
} from '../utils'

export interface AvailableField {
  name: string
  type: string
}

export interface TransformationActionsOptions {
  readOnly: boolean
  standalone: boolean
  onCompleteStep: (stepName: string) => void
  onCompleteStandaloneEditing?: () => void
}

export interface TransformationActionsStores {
  transformationStore: {
    addField: (options: { type: 'passthrough' | 'computed' }) => void
    updateField: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
    removeField: (fieldId: string) => void
    clearFields: () => void
    addAllFieldsAsPassthrough: (fields: AvailableField[]) => void
    skipTransformation: () => void
    setExpressionString: (expression: string) => void
    setLastSavedTransformationSnapshot: (config: TransformationConfig | null) => void
    resetTransformationStore: () => void
  }
  validationEngine: {
    onSectionConfigured: (stepKey: StepKeys) => void
  }
  coreStore: {
    markAsDirty: () => void
  }
}

export interface TransformationActionsValidation {
  setSaveAttempted: (value: boolean) => void
  setLocalValidation: (validation: TransformationConfigValidation) => void
}

export interface UseTransformationActionsReturn {
  /** Add a new passthrough field */
  handleAddPassthroughField: () => void
  /** Add a new computed field */
  handleAddComputedField: () => void
  /** Update an existing field */
  handleUpdateField: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
  /** Remove a field */
  handleRemoveField: (fieldId: string) => void
  /** Clear all fields */
  handleClearAllFields: () => void
  /** Restore source fields from available fields */
  handleRestoreSourceFields: () => void
  /** Skip transformation step */
  handleSkip: () => void
  /** Save transformation and continue */
  handleSave: () => void
  /** Discard all changes */
  handleDiscardChanges: () => void
}

/**
 * Hook to manage all transformation action handlers.
 *
 * Consolidates callbacks for:
 * - Adding/updating/removing fields
 * - Clearing and restoring fields
 * - Skipping, saving, and discarding transformations
 *
 * @param stores - Store instances for transformation, validation engine, and core
 * @param transformationConfig - Current transformation configuration
 * @param availableFields - Available fields from schema/event
 * @param options - Component options (readOnly, standalone, callbacks)
 * @param validation - Validation state setters
 * @param setIsSaveSuccess - Callback to set save success state
 * @param setHasAutoPopulated - Callback to set auto-populated state
 * @returns Object containing all action handlers
 */
export function useTransformationActions(
  stores: TransformationActionsStores,
  transformationConfig: TransformationConfig,
  availableFields: AvailableField[],
  options: TransformationActionsOptions,
  validation: TransformationActionsValidation,
  setIsSaveSuccess: (value: boolean) => void,
  setHasAutoPopulated: (value: boolean) => void
): UseTransformationActionsReturn {
  const { transformationStore, validationEngine, coreStore } = stores
  const { readOnly, standalone, onCompleteStep, onCompleteStandaloneEditing } = options
  const { setSaveAttempted, setLocalValidation } = validation

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
    [transformationStore]
  )

  // Remove a field
  const handleRemoveField = useCallback(
    (fieldId: string) => {
      transformationStore.removeField(fieldId)
    },
    [transformationStore]
  )

  // Clear all fields
  const handleClearAllFields = useCallback(() => {
    transformationStore.clearFields()
  }, [transformationStore])

  // Restore source fields
  const handleRestoreSourceFields = useCallback(() => {
    if (readOnly || standalone || availableFields.length === 0) {
      return
    }

    // Auto-populate all fields as pass-through (replaces existing fields)
    transformationStore.addAllFieldsAsPassthrough(availableFields)
    setHasAutoPopulated(true)
  }, [transformationStore, availableFields, readOnly, standalone, setHasAutoPopulated])

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
    const validationResult = validateTransformationConfig(transformationConfig)
    setLocalValidation(validationResult)

    if (!validationResult.isValid) {
      return
    }

    // Generate final expression
    const expression = toTransformationExpr(transformationConfig)
    transformationStore.setExpressionString(expression)

    // Mark section as valid
    validationEngine.onSectionConfigured(StepKeys.TRANSFORMATION_CONFIGURATOR)

    if (standalone && onCompleteStandaloneEditing) {
      coreStore.markAsDirty()
      transformationStore.setLastSavedTransformationSnapshot(
        JSON.parse(JSON.stringify(transformationConfig))
      )
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
    setSaveAttempted,
    setLocalValidation,
    setIsSaveSuccess,
  ])

  // Discard changes
  const handleDiscardChanges = useCallback(() => {
    transformationStore.resetTransformationStore()
  }, [transformationStore])

  return {
    handleAddPassthroughField,
    handleAddComputedField,
    handleUpdateField,
    handleRemoveField,
    handleClearAllFields,
    handleRestoreSourceFields,
    handleSkip,
    handleSave,
    handleDiscardChanges,
  }
}
