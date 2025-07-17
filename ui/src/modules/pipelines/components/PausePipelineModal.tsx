import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'

const PauseDescriptionMessage = () => {
  return (
    <>
      <p>Any events currently in the queue will be processed before pausing, which may take some time.</p>
      <br />
      <p>Are you sure you want to pause?</p>
    </>
  )
}

const config = {
  title: 'Pause Pipeline?',
  description: <PauseDescriptionMessage />,
  okButtonText: 'Pause Pipeline',
  cancelButtonText: 'Cancel',
}

function PausePipelineModal({ visible, onOk, onCancel }: { visible: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <InfoModal
      visible={visible}
      title={config.title}
      description={<PauseDescriptionMessage />}
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
