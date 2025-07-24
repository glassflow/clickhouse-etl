import { FormEditActionButtonGroup } from '@/src/components/shared/FormEditActionButtonGroup'
import FormActionButton from '@/src/components/shared/FormActionButton'

type FormActionsProps = {
  standalone?: boolean
  handleSubmit: () => void
  isLoading?: boolean
  isSuccess?: boolean
  disabled?: boolean
  successText?: string
  loadingText?: string
  regularText?: string
  actionType?: 'primary' | 'secondary' | 'tertiary'
  showLoadingIcon?: boolean
}

function FormActions({
  standalone,
  handleSubmit,
  isLoading,
  isSuccess,
  disabled,
  successText,
  loadingText,
  regularText,
  actionType,
  showLoadingIcon,
}: FormActionsProps) {
  return (
    <div className="flex gap-4">
      {standalone && (
        <FormEditActionButtonGroup
          editModeDefault={false}
          onEnableEditMode={() => {}}
          onSaveChanges={() => {}}
          onDiscardChanges={() => {}}
        />
      )}

      {!standalone && (
        <FormActionButton
          onClick={handleSubmit}
          isLoading={isLoading}
          isSuccess={isSuccess}
          disabled={disabled}
          successText={successText}
          loadingText={loadingText}
          regularText={regularText}
          actionType={actionType}
          showLoadingIcon={showLoadingIcon}
        />
      )}
    </div>
  )
}

export default FormActions
