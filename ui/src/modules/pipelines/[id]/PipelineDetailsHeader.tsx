'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { Copy, Check } from 'lucide-react'
import PipelineActionButton from '@/src/components/shared/PipelineActionButton'
import DeletePipelineModal from '@/src/modules/pipelines/components/DeletePipelineModal'
import RenamePipelineModal from '@/src/modules/pipelines/components/RenamePipelineModal'
import EditPipelineModal from '@/src/modules/pipelines/components/EditPipelineModal'
import PausePipelineModal from '@/src/modules/pipelines/components/PausePipelineModal'
import { Pipeline } from '@/src/types/pipeline'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { PipelineAction } from '@/src/types/pipeline'
import { usePipelineHealth } from '@/src/hooks/usePipelineHealth'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import PlayIcon from '@/src/images/play.svg'
import EditIcon from '@/src/images/edit.svg'
import RenameIcon from '@/src/images/rename.svg'
import DeleteIcon from '@/src/images/delete.svg'
import PauseIcon from '@/src/images/pause.svg'
import { PipelineStatus } from '@/src/types/pipeline'

interface PipelineDetailsHeaderProps {
  pipeline: Pipeline
  onPipelineUpdate?: (updatedPipeline: Pipeline) => void
  onPipelineDeleted?: () => void
  actions?: React.ReactNode
}

function PipelineDetailsHeader({ pipeline, onPipelineUpdate, onPipelineDeleted, actions }: PipelineDetailsHeaderProps) {
  const [activeModal, setActiveModal] = useState<PipelineAction | null>(null)
  const [copied, setCopied] = useState(false)

  // Use simplified pipeline health monitoring
  const {
    health,
    isLoading: healthLoading,
    error: healthError,
  } = usePipelineHealth({
    pipelineId: pipeline.pipeline_id,
    enabled: true,
    pollingInterval: 5000, // 5 seconds - conservative interval
    stopOnStatuses: ['Running', 'Terminated', 'Failed'], // Stop on stable states
    maxRetries: 2,
    onStatusChange: (newStatus, previousStatus) => {
      console.log(`Pipeline ${pipeline.pipeline_id} health status changed: ${previousStatus} → ${newStatus}`)
    },
    onError: (error) => {
      console.error(`Pipeline ${pipeline.pipeline_id} health check error:`, error)
    },
  })

  const {
    actionState,
    executeAction,
    getActionConfiguration,
    getButtonText,
    isActionDisabled,
    shouldShowModal,
    clearError,
  } = usePipelineActions(pipeline)

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
      } else if (action === 'rename' && onPipelineUpdate) {
        // For rename action, if no result is returned, create updated pipeline object manually
        // This ensures the UI is updated immediately with the new name
        const updatedPipeline = {
          ...pipeline,
          name: payload?.name || pipeline.name,
        }
        onPipelineUpdate(updatedPipeline)
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

  const handleCopyPipelineId = async () => {
    try {
      await navigator.clipboard.writeText(pipeline.pipeline_id)
      setCopied(true)
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy pipeline ID:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = pipeline.pipeline_id
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const getStatusVariant = (status: string) => {
    // Use health data if available, otherwise fall back to pipeline status
    const effectiveStatus = health?.overall_status || status

    switch (effectiveStatus) {
      case 'Running':
        return 'success'
      case 'Created':
        return 'default'
      case 'Terminating':
        return 'warning'
      case 'Terminated':
        return 'secondary'
      case 'Failed':
        return 'error'
      case 'active':
        return 'success'
      case 'paused':
        return 'warning'
      case 'pausing':
        return 'warning'
      case 'deleting':
        return 'secondary'
      case 'error':
        return 'error'
      case 'deleted':
        return 'secondary'
      case 'no_configuration':
        return 'default'
      default:
        return 'default'
    }
  }

  const getBadgeLabel = (status: PipelineStatus) => {
    // Use health data if available, otherwise fall back to pipeline status
    const effectiveStatus = health?.overall_status || status

    switch (effectiveStatus) {
      case 'Running':
        return 'Running'
      case 'Created':
        return 'Starting...'
      case 'Terminating':
        return 'Terminating...'
      case 'Terminated':
        return 'Terminated'
      case 'Failed':
        return 'Failed'
      case 'active':
        return 'Active'
      case 'deploying':
        return 'Deploying'
      case 'deleted':
        return 'Deleted'
      case 'deploy_failed':
        return 'Deploy Failed'
      case 'delete_failed':
        return 'Delete Failed'
      case 'no_configuration':
        return 'No Configuration'
      case 'pausing':
        return 'Pausing'
      case 'paused':
        return 'Paused'
      case 'error':
        return 'Error'
      default:
        return 'Unknown status'
    }
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
        className={`group ${action === 'resume' ? 'btn-primary' : 'btn-action'}`}
        title={config.disabledReason}
      >
        {actionState.isLoading && actionState.lastAction === action ? (
          <span className="flex items-center gap-3">
            <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
            Loading...
          </span>
        ) : (
          <div className="flex items-center gap-3">
            {action === 'resume' && (
              <Image
                src={PlayIcon}
                alt="Start"
                width={16}
                height={16}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'pause' && (
              <Image
                src={PauseIcon}
                alt="Pause"
                width={16}
                height={16}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'rename' && (
              <Image
                src={RenameIcon}
                alt="Rename"
                width={16}
                height={16}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'delete' && (
              <Image
                src={DeleteIcon}
                alt="Delete"
                width={16}
                height={16}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'edit' && (
              <Image
                src={EditIcon}
                alt="Edit"
                width={16}
                height={16}
                className="filter brightness-0 group-hover:brightness-0"
              />
            )}
            {buttonText}
          </div>
        )}
      </Button>
    )
  }

  const getActionButtons = () => {
    // TEMPORARILY DISABLED - PAUSE/RESUME/EDIT FUNCTIONALITY DISABLED FOR DEMO
    // Show resume button if paused, pause button if active
    const showPause = pipeline.status === 'active'
    const showResume = pipeline.status === 'paused'

    return (
      <>
        {/* TEMPORARILY COMMENTED OUT - EDIT FUNCTIONALITY DISABLED FOR DEMO */}
        {/* {showResume && renderActionButton('resume')} */}
        {renderActionButton('rename')}
        {renderActionButton('delete')}
        {/* {showPause && renderActionButton('pause')} */}
        {/* {renderActionButton('edit')} */}
      </>
    )
  }

  return (
    <>
      <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2">
            <div className="flex flex-row flex-start gap-2 items-center">
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
              <Badge variant={getStatusVariant(pipeline.status || 'no_configuration')} className="rounded-xl my-2 mx-4">
                {healthLoading
                  ? 'Checking...'
                  : getBadgeLabel((pipeline.status || 'no_configuration') as PipelineStatus)}
              </Badge>
              {healthError && (
                <Badge variant="destructive" className="ml-2">
                  Health Error
                </Badge>
              )}
              {actionState.error && (
                <Badge variant="destructive" className="ml-2">
                  {actionState.error}
                </Badge>
              )}
            </div>
            <div className="flex flex-row flex-end gap-2">{actions || getActionButtons()}</div>
          </div>
          <div className="flex flex-start items-center gap-1 text-sm text-muted-foreground">
            {pipeline.pipeline_id ? (
              <div className="group flex items-center gap-1">
                <span
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={handleCopyPipelineId}
                  title="Click to copy pipeline ID"
                >
                  Pipeline ID: {pipeline.pipeline_id}
                </span>
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                {copied && (
                  <Badge variant="secondary" className="ml-2 h-6 w-18 text-sm">
                    Copied
                  </Badge>
                )}
              </div>
            ) : (
              <span>Pipeline ID: None</span>
            )}
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

      {/* TEMPORARILY COMMENTED OUT - EDIT FUNCTIONALITY DISABLED FOR DEMO */}
      {/* Edit Modal */}
      {/* <EditPipelineModal
        visible={activeModal === 'edit'}
        onOk={() => {
          // Note: EditPipelineModal needs to be updated to capture edit data
          // For now, this is a placeholder
          handleModalConfirm('edit', {})
        }}
        onCancel={handleModalCancel}
      /> */}

      {/* Pause Modal */}
      {/* <PausePipelineModal
        visible={activeModal === 'pause'}
        onOk={() => {
          handleModalConfirm('pause')
        }}
        onCancel={handleModalCancel}
      /> */}
    </>
  )
}

export default PipelineDetailsHeader
