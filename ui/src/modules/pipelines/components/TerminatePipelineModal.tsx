import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function TerminatePipelineModal({
  visible,
  onOk,
  onCancel,
}: {
  visible: boolean
  onOk: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmationModal
      visible={visible}
      title="Terminate Pipeline?"
      description={`<div>
        <div style="margin-bottom: 16px;">The pipeline will be terminated immediately without processing remaining events in the queue.</div>
        <div>Are you sure you want to terminate the pipeline?</div>
      </div>`}
      okButtonText="Terminate Pipeline"
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

export default TerminatePipelineModal
