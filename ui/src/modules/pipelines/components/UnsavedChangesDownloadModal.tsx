import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

function UnsavedChangesDownloadModal({
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
      title="Unsaved Changes Detected"
      description={`<div>
        <div style="margin-bottom: 16px;">You have unsaved changes that haven't been deployed yet.</div>
        <div style="margin-bottom: 16px;">The downloaded configuration will reflect the <strong>currently deployed version</strong>, not your local changes.</div>
        <div>To include your changes in the configuration:</div>
        <ol style="margin-top: 8px; margin-left: 20px; list-style-type: decimal;">
          <li>Click "Resume" to deploy your changes</li>
          <li>Wait for the pipeline to become active</li>
          <li>Download the configuration</li>
        </ol>
      </div>`}
      okButtonText="Download Anyway"
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

export default UnsavedChangesDownloadModal
