import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function FlushDLQModal({
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
      title="Clear Error Queue?"
      description={`<div>
        <div style="margin-bottom: 16px;">This will permanently delete all failed events currently in the error queue.</div>
        <div>Are you sure you want to clear the error queue?</div>
      </div>`}
      okButtonText="Clear Error Queue"
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

export default FlushDLQModal

