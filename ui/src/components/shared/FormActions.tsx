import { FormEditActionButtonGroup } from '@/src/components/shared/FormEditActionButtonGroup'
import FormActionButton from '@/src/components/shared/FormActionButton'

type FormActionsProps = {
  onSubmit: () => void
  onDiscard?: () => void
  toggleEditMode?: () => void
  standalone?: boolean
  readOnly?: boolean
  disabled?: boolean
  isLoading?: boolean
  isSuccess?: boolean
  successText?: string
  loadingText?: string
  regularText?: string
  actionType?: 'primary' | 'secondary' | 'tertiary'
  showLoadingIcon?: boolean
}

function FormActions({
  onSubmit,
  onDiscard,
  toggleEditMode,
  standalone,
  readOnly,
  disabled,
  isLoading,
  isSuccess,
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
          editMode={!readOnly}
          onSubmit={onSubmit}
          onDiscard={onDiscard || (() => {})}
          toggleEditMode={toggleEditMode}
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

      {!standalone && (
        <FormActionButton
          onClick={onSubmit}
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
