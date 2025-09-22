'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FormModal } from '@/src/components/common/FormModal'
import { validateAndGeneratePipelineId } from '@/src/utils/pipeline-id'
import { checkPipelineExists } from '@/src/api/pipeline-api'

type CreatePipelineModalProps = {
  visible: boolean
  onComplete: (result: string, value?: string, pipelineId?: string) => void
  mode?: 'create' | 'rename'
  initialValue?: string
  currentName?: string
  isNavigating?: boolean
}

const CreatePipelineModal = ({
  visible,
  onComplete,
  mode = 'create',
  initialValue = '',
  currentName,
  isNavigating = false,
}: CreatePipelineModalProps) => {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [generatedId, setGeneratedId] = useState<string>('')
  const [isValid, setIsValid] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [shouldRefocus, setShouldRefocus] = useState(false)

  const isRenameMode = mode === 'rename'

  useEffect(() => {
    if (visible) {
      setStatusMessage(null)
      setValidationError(null)
      setGeneratedId('')
      setIsValidating(false)
      setIsValid(false)
    }
  }, [visible, currentName])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const validatePipelineName = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        return 'Pipeline name is required'
      }

      if (value.length < 3) {
        return 'Pipeline name must be at least 3 characters long'
      }

      if (value.length > 100) {
        return 'Pipeline name must be 100 characters or less'
      }

      // For rename mode, we don't need to generate a new ID
      if (isRenameMode) {
        return null
      }

      // Generate and validate pipeline ID
      setIsValidating(true)
      setStatusMessage('Generating unique pipeline ID...')
      try {
        const result = await validateAndGeneratePipelineId(value, checkPipelineExists)

        if (result.isValid) {
          setGeneratedId(result.id)
          setValidationError(null)
          setIsValid(true)
          setStatusMessage(`Generated ID: ${result.id}`)
          return null
        } else {
          setGeneratedId('')
          setValidationError(result.error || 'Invalid pipeline name')
          setIsValid(false)
          setStatusMessage(null)
          return result.error || 'Invalid pipeline name'
        }
      } catch (error) {
        setGeneratedId('')
        setValidationError('Failed to validate pipeline name')
        setIsValid(false)
        setStatusMessage(null)
        return 'Failed to validate pipeline name'
      } finally {
        setIsValidating(false)
      }
    },
    [isRenameMode],
  )

  const debouncedValidation = useCallback(
    (value: string) => {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Check if input is currently focused - if so, we'll want to refocus after validation
      const inputElement = document.querySelector(
        'input[placeholder="e.g., Production Pipeline v1"]',
      ) as HTMLInputElement
      const isInputFocused = document.activeElement === inputElement
      if (isInputFocused) {
        setShouldRefocus(true)
      }

      // Set new timeout for validation
      debounceTimeoutRef.current = setTimeout(async () => {
        const error = await validatePipelineName(value)
        setValidationError(error)

        // Refocus the input if it was focused before validation and validation completed successfully
        if (isInputFocused && !error && !isRenameMode) {
          // Use a small delay to ensure the DOM has updated
          setTimeout(() => {
            inputElement?.focus()
            setShouldRefocus(false)
          }, 50)
        }
      }, 1000) // 1 second delay
    },
    [validatePipelineName, isRenameMode],
  )

  const handleComplete = (result: string, value?: string) => {
    // Handle cancellation - always allow
    if (result === 'CANCEL') {
      onComplete(result)
      return
    }

    // For YES result, only proceed if everything is ready
    if (result === 'YES') {
      // Don't proceed if still validating or navigating
      if (isValidating || isNavigating) {
        return // Silently ignore the click
      }

      // For create mode, ensure pipeline ID is generated and valid
      if (!isRenameMode && !isValid) {
        return // Silently ignore the click
      }

      // All checks passed - proceed with completion
      onComplete(result, value, generatedId)
    }
  }

  const handleChange = (value: string) => {
    // Clear validation state while typing
    setValidationError(null)
    setIsValid(false)
    setStatusMessage(null)

    // Trigger debounced validation
    debouncedValidation(value)
  }

  return (
    <FormModal
      visible={visible}
      title={isRenameMode ? 'Rename Pipeline' : 'Create New Pipeline'}
      description={
        isRenameMode
          ? 'Enter a new name for your pipeline.'
          : 'Enter a name for your pipeline. A unique ID will be generated automatically.'
      }
      inputLabel="Name"
      secondaryLabel={
        isNavigating
          ? 'Creating pipeline and navigating to wizard...'
          : statusMessage || (isRenameMode ? `Current: ${currentName}` : '')
      }
      inputPlaceholder="e.g., Production Pipeline v1"
      submitButtonText={isRenameMode ? 'Rename Pipeline' : 'Create Pipeline'}
      cancelButtonText={isRenameMode ? 'Cancel' : 'Discard'}
      onComplete={handleComplete}
      onChange={handleChange}
      initialValue={initialValue}
      isLoading={isValidating || isNavigating}
      validation={async (value) => {
        // For immediate validation (on submit), check current validation state
        if (isValidating) {
          return 'Generating unique pipeline ID...'
        }

        if (isNavigating) {
          return 'Creating pipeline and navigating to wizard...'
        }

        // For create mode, ensure pipeline ID is generated and valid
        if (!isRenameMode && !isValid) {
          return 'Please wait for pipeline ID generation to complete'
        }

        // Return any validation errors from the debounced validation
        return validationError
      }}
    />
  )
}

export default CreatePipelineModal
