import { useState, useEffect } from 'react'
import FormActionButton from './FormActionButton'

export const FormEditActionButtonGroup = ({
  editMode,
  toggleEditMode,
  onSubmit,
  onDiscard,
  isLoading,
  isSuccess,
  disabled,
  successText,
  loadingText,
  regularText,
  actionType,
  showLoadingIcon,
}: {
  editMode?: boolean
  toggleEditMode?: () => void
  onSubmit: () => void
  onDiscard: () => void
  isLoading?: boolean
  isSuccess?: boolean
  disabled?: boolean
  successText?: string
  loadingText?: string
  regularText?: string
  actionType?: 'primary' | 'secondary' | 'tertiary'
  showLoadingIcon?: boolean
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async () => {
    // Don't toggle edit mode immediately - wait for operation to complete
    await onSubmit()

    // Only toggle edit mode if the operation was successful
    if (isSuccess) {
      toggleEditMode?.()
    }
  }

  const handleDiscard = () => {
    onDiscard()
    // Discard is immediate, so we can toggle edit mode right away
    toggleEditMode?.()
  }

  return (
    <div className="overflow-hidden pt-2">
      <div
        className={`flex gap-3 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        {editMode ? (
          <>
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <FormActionButton
                onClick={handleSubmit}
                regularText="Save changes"
                isLoading={isLoading}
                isSuccess={isSuccess}
                disabled={disabled || isLoading}
                successText={successText}
                loadingText={loadingText}
                actionType={actionType}
                showLoadingIcon={showLoadingIcon}
              />
            </div>
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <FormActionButton
                actionType="secondary"
                onClick={handleDiscard}
                regularText="Discard"
                disabled={isLoading}
              />
            </div>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            <FormActionButton actionType="primary" onClick={toggleEditMode} regularText="Edit" />
          </div>
        )}
      </div>
    </div>
  )
}
