import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'

const EditDescriptionMessage = () => {
  return (
    <>
      <p>
        To edit the pipeline, it must be paused first. Any events currently in the queue will be processed before
        pausing, which may take some time.
      </p>
      <br />
      <p>Are you sure you want to pause and edit the pipeline?</p>
    </>
  )
}

const config = {
  title: 'Edit Pipeline?',
  description: <EditDescriptionMessage />,
  okButtonText: 'Pause and Edit Pipeline',
  cancelButtonText: 'Cancel',
}

function PausePipelineModal({ visible, onOk, onCancel }: { visible: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <InfoModal
      visible={visible}
      title={config.title}
      description={<EditDescriptionMessage />}
      okButtonText={config.okButtonText}
      cancelButtonText={config.cancelButtonText}
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
