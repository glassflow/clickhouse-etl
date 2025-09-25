import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'
import { Checkbox } from '@/src/components/ui/checkbox'
import { useState } from 'react'

function StopPipelineModal({
  visible,
  onOk,
  onCancel,
  callback,
}: {
  visible: boolean
  onOk: (isGraceful: boolean) => void
  onCancel: () => void
  callback?: (result: boolean) => void
}) {
  const [isGraceful, setIsGraceful] = useState(true)

  const handleCheckboxChange = (checked: boolean) => {
    setIsGraceful(checked)
    if (callback) {
      callback(checked)
    }
  }

  return (
    <ConfirmationModal
      visible={visible}
      title="Stop Pipeline?"
      description={`<div>
                      <div className="mb-4">Stopping this pipeline will permanently end its execution. You won't be able to restart it later.</div> \
                      <div>Are you sure you want to stop the pipeline?</div> \
                    </div>`}
      content={
        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            id="graceful-stop"
            className="border-input"
            checked={isGraceful}
            onCheckedChange={handleCheckboxChange}
          />
          <span className="text-sm">Process events in the queue (if any) before stopping</span>
        </div>
      }
      okButtonText="Stop Pipeline"
      cancelButtonText="Cancel"
      onComplete={(result) => {
        if (result === ModalResult.YES) {
          onOk(isGraceful)
        } else {
          onCancel()
        }
      }}
      criticalOperation={true}
    />
  )
}

export default StopPipelineModal
