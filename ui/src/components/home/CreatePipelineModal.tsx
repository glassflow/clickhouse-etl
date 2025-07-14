'use client'

import { useState, useEffect } from 'react'

import { FormModal } from '@/src/components/common/FormModal'

type CreatePipelineModalProps = {
  visible: boolean
  onComplete: (result: string, value?: string) => void
}

const CreatePipelineModal = ({ visible, onComplete }: CreatePipelineModalProps) => {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [secondaryLabel, setSecondaryLabel] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSecondaryLabel(null)
      setValidationError(null)
    }
  }, [visible])

  const validatePipelineName = (value: string) => {
    // TODO: add validation for pipeline name - it has to be unique
    console.log('validatePipelineName', value)
    return true
  }

  const handleComplete = (result: string, value?: string) => {
    console.log('handleComplete', result, value)
    onComplete(result, value)
  }

  const handleChange = (value: string) => {
    // TODO: add validation for pipeline name - it has to be unique
    console.log('handleChange', value)

    const result = validatePipelineName(value)
    setValidationError(result ? null : 'Pipeline name is not unique')
    setSecondaryLabel(value)
  }

  return (
    <FormModal
      visible={visible}
      title="Create New Pipeline"
      description=""
      inputLabel="Name"
      secondaryLabel={secondaryLabel || ''}
      inputPlaceholder="e.g., Production Pipeline v1"
      submitButtonText="Create Pipeline"
      cancelButtonText="Discard"
      onComplete={handleComplete}
      onChange={handleChange}
      initialValue=""
      validation={(value) => {
        if (!value.trim()) {
          return 'Pipeline name is required'
        }
        if (value.length < 3) {
          return 'Pipeline name must be at least 3 characters long'
        }

        if (validationError) {
          return validationError
        }

        // TODO: add missing validation for pipeline name
        return null
      }}
    />
  )
}

export default CreatePipelineModal
