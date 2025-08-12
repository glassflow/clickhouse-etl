import { ModalResult } from '@/src/components/common/InfoModal'
import CreatePipelineModal from '@/src/components/home/CreatePipelineModal'

function RenamePipelineModal({
  visible,
  onOk,
  onCancel,
  currentName,
}: {
  visible: boolean
  onOk: (newName: string) => void
  onCancel: () => void
  currentName: string
}) {
  const handleComplete = (result: string, value?: string) => {
    if (result === ModalResult.YES && value) {
      onOk(value)
    } else {
      onCancel()
    }
  }

  return (
    <CreatePipelineModal
      visible={visible}
      onComplete={handleComplete}
      mode="rename"
      initialValue={currentName}
      currentName={currentName}
    />
  )
}

export default RenamePipelineModal
