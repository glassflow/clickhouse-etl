'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { StatusBadge } from '@/src/components/common/StatusBadge'
import { StatusType } from '@/src/config/constants'
import PipelineActionButton from '@/src/components/shared/PipelineActionButton'
import DeletePipelineModal from '@/src/modules/pipelines/components/DeletePipelineModal'
import RenamePipelineModal from '@/src/modules/pipelines/components/RenamePipelineModal'
import EditPipelineModal from '@/src/modules/pipelines/components/EditPipelineModal'
import PausePipelineModal from '@/src/modules/pipelines/components/PausePipelineModal'
import { Pipeline } from '@/src/types/pipeline'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { PipelineAction } from '@/src/types/pipeline'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

interface PipelineDetailsHeaderProps {
  pipeline: Pipeline
  onPipelineUpdate?: (updatedPipeline: Pipeline) => void
  onPipelineDeleted?: () => void
  actions?: React.ReactNode
  onActionStateChange?: (actionState: any) => void
}

function PipelineDetailsHeader({
  pipeline,
  onPipelineUpdate,
  onPipelineDeleted,
  actions,
  onActionStateChange,
}: PipelineDetailsHeaderProps) {
  const [activeModal, setActiveModal] = useState<PipelineAction | null>(null)

  const {
    actionState,
    executeAction,
    getActionConfiguration,
    getButtonText,
    isActionDisabled,
    shouldShowModal,
    clearError,
  } = usePipelineActions(pipeline)

  // Notify parent component when action state changes
  useEffect(() => {
    onActionStateChange?.(actionState)
  }, [actionState, onActionStateChange])

  const handleActionClick = async (action: PipelineAction) => {
    const config = getActionConfiguration(action)

    if (config.isDisabled) {
      return // Button should be disabled, but extra safety check
    }

    if (shouldShowModal(action)) {
      setActiveModal(action)
    } else {
      // Execute action directly (like resume)
      try {
        const result = await executeAction(action)
        if (result && onPipelineUpdate) {
          onPipelineUpdate(result as Pipeline)
        }
      } catch (error) {
        console.error(`Failed to ${action} pipeline:`, error)
      }
    }
  }

  const handleModalConfirm = async (action: PipelineAction, payload?: any) => {
    // Close modal immediately after user confirms
    setActiveModal(null)

    try {
      const result = await executeAction(action, payload)

      if (action === 'delete') {
        onPipelineDeleted?.()
      } else if (result && onPipelineUpdate) {
        onPipelineUpdate(result as Pipeline)
      }
    } catch (error) {
      console.error(`Failed to ${action} pipeline:`, error)
      // Error will be shown in the header via actionState.error
    }
  }

  const handleModalCancel = () => {
    setActiveModal(null)
    clearError()
  }

  const renderActionButton = (action: PipelineAction) => {
    const config = getActionConfiguration(action)
    const buttonText = getButtonText(action)
    const disabled = isActionDisabled(action)

    // Use regular Button for more flexibility with loading states and disabled state
    return (
      <Button
        key={action}
        variant="outline"
        onClick={() => handleActionClick(action)}
        disabled={disabled}
        className="btn-action"
        title={config.disabledReason}
      >
        {actionState.isLoading && actionState.lastAction === action ? (
          <span className="flex items-center gap-1">
            <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
            Loading...
          </span>
        ) : (
          buttonText
        )}
      </Button>
    )
  }

  const getActionButtons = () => {
    // Show resume button if paused, pause button if active
    const showPause = pipeline.status === 'active'
    const showResume = pipeline.status === 'paused'

    return (
      <>
        {showResume && renderActionButton('resume')}
        {renderActionButton('rename')}
        {renderActionButton('delete')}
        {showPause && renderActionButton('pause')}
      </>
    )
  }

  return (
    <>
      <Card className="border-[var(--color-border-neutral)] rounded-md py-2 px-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2">
            <div className="flex flex-row flex-start gap-2">
              {actionState.isLoading && (
                <div className="flex items-center gap-2">
                  <Image src={Loader} alt="Loading" width={24} height={24} className="animate-spin" />
                  <span className="text-sm text-blue-600 font-medium">
                    {actionState.lastAction === 'pause' && 'Pausing pipeline...'}
                    {actionState.lastAction === 'resume' && 'Resuming pipeline...'}
                    {actionState.lastAction === 'delete' && 'Deleting pipeline...'}
                    {actionState.lastAction === 'rename' && 'Renaming pipeline...'}
                    {actionState.lastAction === 'edit' && 'Updating pipeline...'}
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-bold">{pipeline.name}</h2>
              <StatusBadge status={pipeline.status as StatusType} />
              {actionState.error && (
                <Badge variant="destructive" className="ml-2">
                  {actionState.error}
                </Badge>
              )}
            </div>
            <div className="flex flex-row flex-end gap-2">{actions || getActionButtons()}</div>
          </div>
        </div>
      </Card>

      {/* Delete Modal */}
      <DeletePipelineModal
        visible={activeModal === 'delete'}
        onOk={(processEvents) => {
          handleModalConfirm('delete', { graceful: processEvents })
        }}
        onCancel={handleModalCancel}
        callback={(result) => {
          console.log('Process events gracefully:', result)
        }}
      />

      {/* Rename Modal */}
      <RenamePipelineModal
        visible={activeModal === 'rename'}
        currentName={pipeline.name}
        onOk={(newName) => {
          handleModalConfirm('rename', { name: newName })
        }}
        onCancel={handleModalCancel}
      />

      {/* Edit Modal */}
      <EditPipelineModal
        visible={activeModal === 'edit'}
        onOk={() => {
          // Note: EditPipelineModal needs to be updated to capture edit data
          // For now, this is a placeholder
          handleModalConfirm('edit', {})
        }}
        onCancel={handleModalCancel}
      />

      {/* Pause Modal */}
      <PausePipelineModal
        visible={activeModal === 'pause'}
        onOk={() => {
          handleModalConfirm('pause')
        }}
        onCancel={handleModalCancel}
      />
    </>
  )
}

export default PipelineDetailsHeader
