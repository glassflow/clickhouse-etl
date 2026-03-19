'use client'

import { useState, useEffect, useMemo } from 'react'
import { TransformationConfig, TransformationField } from '@/src/store/transformation.store'
import { validateTransformationConfig, TransformationConfigValidation, toTransformationExpr } from '../utils'

export interface ValidationErrorDetail {
  fieldName: string
  errors: string[]
}

export interface UseTransformationValidationReturn {
  /** Current validation state */
  localValidation: TransformationConfigValidation
  /** Set validation state (e.g. after Save click so UI updates immediately) */
  setLocalValidation: (validation: TransformationConfigValidation) => void
  /** Whether a save has been attempted (used to show/hide errors) */
  saveAttempted: boolean
  /** Set save attempted state */
  setSaveAttempted: (value: boolean) => void
  /** Structured error details for display */
  validationErrorDetails: ValidationErrorDetail[]
  /** Total count of all errors */
  totalErrorCount: number
  /** Whether validation details section is expanded */
  isValidationExpanded: boolean
  /** Toggle validation details expansion */
  setIsValidationExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
}

/**
 * Hook to manage transformation validation state and computed values.
 *
 * Handles:
 * - Local validation state
 * - Save attempt tracking
 * - Validation error details computation
 * - Expression string generation
 *
 * @param transformationConfig - Current transformation configuration
 * @param transformationStore - Store for setting expression string (optional)
 * @returns Validation state and actions
 */
export function useTransformationValidation(
  transformationConfig: TransformationConfig,
  transformationStore?: { setExpressionString: (expr: string) => void },
): UseTransformationValidationReturn {
  // Local validation state
  const [localValidation, setLocalValidation] = useState<TransformationConfigValidation>({
    isValid: true,
    fieldErrors: {},
    globalErrors: [],
  })

  // Track if save has been attempted
  const [saveAttempted, setSaveAttempted] = useState(false)

  // Track if validation details are expanded
  const [isValidationExpanded, setIsValidationExpanded] = useState(false)

  // Validate configuration when it changes — always store full validation so the user
  // sees why "Save Transformation" is disabled when the config is invalid (no need to click first).
  useEffect(() => {
    const validation = validateTransformationConfig(transformationConfig)
    setLocalValidation(validation)

    // Generate expression string
    if (transformationConfig.enabled && transformationConfig.fields.length > 0 && transformationStore) {
      const expression = toTransformationExpr(transformationConfig)
      transformationStore.setExpressionString(expression)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformationConfig])

  // Get validation error details for the expandable section
  const validationErrorDetails = useMemo((): ValidationErrorDetail[] => {
    const details: ValidationErrorDetail[] = []

    // Collect field-specific errors
    Object.entries(localValidation.fieldErrors).forEach(([fieldId, errors]) => {
      const field = transformationConfig.fields.find((f: TransformationField) => f.id === fieldId)
      const fieldName = field?.outputFieldName || `Field ${fieldId.slice(0, 8)}`
      const errorMessages = Object.values(errors).filter(Boolean) as string[]
      if (errorMessages.length > 0) {
        details.push({ fieldName, errors: errorMessages })
      }
    })

    return details
  }, [localValidation.fieldErrors, transformationConfig.fields])

  // Total error count for display
  const totalErrorCount = useMemo(() => {
    return (
      validationErrorDetails.reduce((sum, detail) => sum + detail.errors.length, 0) +
      localValidation.globalErrors.length
    )
  }, [validationErrorDetails, localValidation.globalErrors])

  return {
    localValidation,
    setLocalValidation,
    saveAttempted,
    setSaveAttempted,
    validationErrorDetails,
    totalErrorCount,
    isValidationExpanded,
    setIsValidationExpanded,
  }
}
