import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function EditConfirmationModal({
  visible,
  onOk,
  onCancel,
  stepName,
}: {
  visible: boolean
  onOk: () => void
  onCancel: () => void
  stepName?: string
}) {
  const description = stepName
    ? `You are about to edit the "${stepName}" configuration. This will pause the pipeline temporarily to allow editing. Any events currently in the queue will be processed before pausing, which may take some time.`
    : 'You are about to edit this pipeline configuration. This will pause the pipeline temporarily to allow editing. Any events currently in the queue will be processed before pausing, which may take some time.'

  return (
    <ConfirmationModal
      visible={visible}
      title="Edit Pipeline Configuration?"
      description={description}
      content={<div className="text-sm text-muted-foreground">Are you sure you want to proceed with editing?</div>}
      okButtonText="Edit Configuration"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk()
        } else {
          onCancel()
        }
      }}
    />
  )
}

export default EditConfirmationModal
