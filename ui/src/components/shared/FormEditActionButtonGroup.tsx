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
  pipelineActionState,
  onClose, // Add close function for read-only mode
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
  pipelineActionState?: any
  onClose?: () => void // Add close function for read-only mode
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Check if pipeline action is in progress (like stopping for editing)
  const isPipelineActionInProgress =
    pipelineActionState?.isLoading &&
    (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit')

  const handleSubmit = async () => {
    // Don't toggle edit mode immediately - wait for operation to complete
    await onSubmit()

    // After successful submission, toggle edit mode to close the form
    // This ensures the form closes after the operation is complete
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
        {/* Show Close button in read-only mode for demo */}
        {!editMode && onClose && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            <FormActionButton
              actionType="primary"
              onClick={onClose} // Direct close function for read-only mode
              regularText="Close"
              disabled={isPipelineActionInProgress}
            />
          </div>
        )}

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
            <FormActionButton
              actionType="primary"
              onClick={toggleEditMode}
              regularText="Edit"
              disabled={isPipelineActionInProgress}
            />
          </div>
        )}
      </div>
    </div>
  )
}
