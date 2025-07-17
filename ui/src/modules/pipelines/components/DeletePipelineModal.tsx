import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { Checkbox } from '@/src/components/ui/checkbox'
import { useState } from 'react'

const config = {
  title: 'Delete Pipeline?',
  description: 'You are about to delete this pipeline permanently. Are you sure you want to continue?',
  okButtonText: 'Delete Pipeline',
  cancelButtonText: 'Cancel',
}

function DeletePipelineModal({
  visible,
  onOk,
  onCancel,
  callback,
}: {
  visible: boolean
  onOk: (processEvents: boolean) => void
  onCancel: () => void
  callback?: (result: boolean) => void
}) {
  const [processEvents, setProcessEvents] = useState(true)

  const handleCheckboxChange = (checked: boolean) => {
    setProcessEvents(checked)
    if (callback) {
      callback(checked)
    }
  }

  return (
    <InfoModal
      visible={visible}
      title={config.title}
      description={
        <>
          <p>You are about to delete this pipeline permanently. Are you sure you want to continue?</p>
          <br />
          <div className="flex items-center gap-2">
            <Checkbox
              id="process-events"
              className="border-input"
              bg-primary
              checked={processEvents}
              onCheckedChange={handleCheckboxChange}
            />
            <p>Process events in the queue (if any) before delete</p>
          </div>
        </>
      }
      okButtonText="Delete Pipeline"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk(processEvents)
        } else {
          onCancel()
        }
      }}
      criticalOperation={true}
    />
  )
}

export default DeletePipelineModal
