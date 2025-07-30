import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'

const EditDescriptionMessage = () => {
  return (
    <>
      <span className="text-sm">
        You are about to edit this pipeline configuration. This will open the pipeline details page where you can
        modify:
      </span>
      <br />
      <ul className="text-sm list-disc list-inside mt-2 space-y-1">
        <li>Kafka connection settings</li>
        <li>Topic selection and deduplication</li>
        <li>Join configurations</li>
        <li>ClickHouse connection and mapping</li>
      </ul>
      <br />
      <span className="text-sm">Are you sure you want to proceed with editing?</span>
    </>
  )
}

const config = {
  title: 'Edit Pipeline Configuration',
  description: <EditDescriptionMessage />,
  okButtonText: 'Edit Pipeline',
  cancelButtonText: 'Cancel',
}

function EditPipelineModal({ visible, onOk, onCancel }: { visible: boolean; onOk: () => void; onCancel: () => void }) {
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

export default EditPipelineModal
