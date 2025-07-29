import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function PausePipelineModal({ visible, onOk, onCancel }: { visible: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <ConfirmationModal
      visible={visible}
      title="Pause Pipeline?"
      description="Any events currently in the queue will be processed before pausing, which may take some time."
      content={<div className="text-sm text-muted-foreground">Are you sure you want to pause?</div>}
      okButtonText="Pause Pipeline"
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

export default PausePipelineModal
