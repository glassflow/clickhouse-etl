import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function StopPipelineModal({ visible, onOk, onCancel }: { visible: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <ConfirmationModal
      visible={visible}
      title="Pause Pipeline?"
      description={`<div>
        <div style="margin-bottom: 16px;">Any events currently in the queue will be processed before pausing, which may take some time.</div>
        <div>Are you sure you want to pause?</div>
      </div>`}
      okButtonText="Pause"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk()
        } else {
          onCancel()
        }
      }}
      criticalOperation={false}
    />
  )
}

export default StopPipelineModal
