import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function DeletePipelineModal({
  visible,
  pipelineName,
  onOk,
  onCancel,
}: {
  visible: boolean
  pipelineName?: string
  onOk: () => void
  onCancel: () => void
}) {
  const description = pipelineName
    ? `<div>
        <div style="margin-bottom: 16px;">The pipeline "${pipelineName}" will be permanently deleted. This action cannot be undone.</div>
        <div>Are you sure you want to delete this pipeline?</div>
      </div>`
    : `<div>
        <div style="margin-bottom: 16px;">The pipeline will be permanently deleted. This action cannot be undone.</div>
        <div>Are you sure you want to delete this pipeline?</div>
      </div>`

  return (
    <ConfirmationModal
      visible={visible}
      title="Delete pipeline?"
      description={description}
      okButtonText="Delete"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk()
        } else {
          onCancel()
        }
      }}
      criticalOperation={true}
    />
  )
}

export default DeletePipelineModal
