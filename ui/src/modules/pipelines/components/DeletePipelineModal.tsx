import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'
import { Checkbox } from '@/src/components/ui/checkbox'
import { useState } from 'react'

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
    <ConfirmationModal
      visible={visible}
      title="Delete Pipeline?"
      description={`<div>You are about to permanently delete this pipeline before processing any events in the queue. </div><br/> <div>Are you sure you want to delete the pipeline?</div>`}
      // NOTE: This is not used for now, but can be used in the future when we return graceful delete
      // content={
      //   <div className="flex items-center gap-2">
      //     <Checkbox
      //       id="process-events"
      //       className="border-input"
      //       bg-primary
      //       checked={processEvents}
      //       onCheckedChange={handleCheckboxChange}
      //     />
      //     <span className="text-sm">Process events in the queue (if any) before delete</span>
      //   </div>
      // }
      okButtonText="Delete Pipeline"
      cancelButtonText="Discard"
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
