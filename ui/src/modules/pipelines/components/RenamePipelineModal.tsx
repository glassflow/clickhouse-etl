import { ModalResult, InfoModal } from '@/src/components/common/InfoModal'

const RenameDescriptionMessage = () => {
  return (
    <>
      <p>
        Renaming the pipeline will have no effect on pipeline. The pipeline will continue to run with the same
        configuration.
      </p>
      <br />
      <p>Are you sure you want to rename the pipeline?</p>
    </>
  )
}

const config = {
  title: 'Rename Pipeline?',
  description: <RenameDescriptionMessage />,
  okButtonText: 'Rename Pipeline',
  cancelButtonText: 'Cancel',
}

function RenamePipelineModal({
  visible,
  onOk,
  onCancel,
}: {
  visible: boolean
  onOk: () => void
  onCancel: () => void
}) {
  return (
    <InfoModal
      visible={visible}
      title={config.title}
      description={config.description}
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

export default RenamePipelineModal
