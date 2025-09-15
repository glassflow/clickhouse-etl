'use client'

import { useState, useEffect, useRef } from 'react'
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
  const recentActionRef = useRef<{ action: PipelineAction; timestamp: number } | null>(null)

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
        // Optimistic status update for immediate UI feedback
        if (action === 'pause' && onPipelineUpdate) {
          const updatedPipeline = {
            ...pipeline,
            status: 'pausing' as Pipeline['status'],
          }
          onPipelineUpdate(updatedPipeline)
        } else if (action === 'resume' && onPipelineUpdate) {
          const updatedPipeline = {
            ...pipeline,
            status: 'resuming' as Pipeline['status'],
          }
          onPipelineUpdate(updatedPipeline)
        }

        const result = await executeAction(action)

        if (result && onPipelineUpdate) {
          onPipelineUpdate(result as Pipeline)
        } else if (action === 'pause' && onPipelineUpdate) {
          // For pause action, update status to paused after successful API call

          recentActionRef.current = { action: 'pause', timestamp: Date.now() }
          const updatedPipeline = {
            ...pipeline,
            status: 'paused' as Pipeline['status'],
          }
          onPipelineUpdate(updatedPipeline)
        } else if (action === 'resume' && onPipelineUpdate) {
          // For resume action, update status to active after successful API call

          recentActionRef.current = { action: 'resume', timestamp: Date.now() }
          const updatedPipeline = {
            ...pipeline,
            status: 'active' as Pipeline['status'],
          }
          onPipelineUpdate(updatedPipeline)
        }
      } catch (error) {
        // Revert optimistic update on error
        if (action === 'pause' && onPipelineUpdate) {
          const revertedPipeline = {
            ...pipeline,
            status: 'active' as Pipeline['status'],
          }
          onPipelineUpdate(revertedPipeline)
        } else if (action === 'resume' && onPipelineUpdate) {
          const revertedPipeline = {
            ...pipeline,
            status: 'paused' as Pipeline['status'],
          }
          onPipelineUpdate(revertedPipeline)
        }
      }
    }
  }

  const handleModalConfirm = async (action: PipelineAction, payload?: any) => {
    try {
      // Optimistic status update for immediate UI feedback BEFORE closing modal
      if (action === 'pause' && onPipelineUpdate) {
        const updatedPipeline = {
          ...pipeline,
          status: 'pausing' as Pipeline['status'],
        }
        onPipelineUpdate(updatedPipeline)
      }

      // Close modal after optimistic update
      setActiveModal(null)

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
      } else if (action === 'pause' && onPipelineUpdate) {
        // For pause action, update status to paused after successful API call

        recentActionRef.current = { action: 'pause', timestamp: Date.now() }
        const updatedPipeline = {
          ...pipeline,
          status: 'paused' as Pipeline['status'],
        }
        onPipelineUpdate(updatedPipeline)
      } else if (action === 'resume' && onPipelineUpdate) {
        // For resume action, update status to active after successful API call

        recentActionRef.current = { action: 'resume', timestamp: Date.now() }
        const updatedPipeline = {
          ...pipeline,
          status: 'active' as Pipeline['status'],
        }
        onPipelineUpdate(updatedPipeline)
      }
    } catch (error) {
      // Revert optimistic update on error
      if (action === 'pause' && onPipelineUpdate) {
        const revertedPipeline = {
          ...pipeline,
          status: 'active' as Pipeline['status'],
        }
        onPipelineUpdate(revertedPipeline)
      }
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
    // Prioritize pipeline status during active actions, otherwise use health data
    let effectiveStatus = status

    // If there's an active action (loading) or recent action completed, use pipeline status instead of health
    const recentAction = recentActionRef.current
    const isRecentAction = recentAction && Date.now() - recentAction.timestamp < 3000 // 3 seconds

    if (health?.overall_status && !actionState.isLoading && !isRecentAction) {
      // Convert backend health status to UI status
      switch (health.overall_status) {
        case 'Running':
          effectiveStatus = 'active'
          break
        case 'Created':
          effectiveStatus = 'deploying'
          break
        case 'Terminating':
          effectiveStatus = 'terminating'
          break
        case 'Terminated':
          effectiveStatus = 'terminated'
          break
        case 'Failed':
          effectiveStatus = 'error'
          break
        default:
          effectiveStatus = status
      }
    }

    switch (effectiveStatus) {
      case 'active':
        return 'success'
      case 'deploying':
        return 'default'
      case 'paused':
        return 'warning'
      case 'pausing':
        return 'warning'
      case 'resuming':
        return 'warning'
      case 'terminating':
        return 'warning'
      case 'terminated':
        return 'secondary'
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
    // Prioritize pipeline status during active actions, otherwise use health data
    let effectiveStatus = status

    // If there's an active action (loading) or recent action completed, use pipeline status instead of health
    const recentAction = recentActionRef.current
    const isRecentAction = recentAction && Date.now() - recentAction.timestamp < 3000 // 3 seconds

    if (health?.overall_status && !actionState.isLoading && !isRecentAction) {
      // Convert backend health status to UI status
      switch (health.overall_status) {
        case 'Running':
          effectiveStatus = 'active'
          break
        case 'Created':
          effectiveStatus = 'deploying'
          break
        case 'Terminating':
          effectiveStatus = 'terminating'
          break
        case 'Terminated':
          effectiveStatus = 'terminated'
          break
        case 'Failed':
          effectiveStatus = 'error'
          break
        default:
          effectiveStatus = status
      }
    }

    switch (effectiveStatus) {
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
        return 'Pausing...'
      case 'paused':
        return 'Paused'
      case 'resuming':
        return 'Resuming...'
      case 'terminating':
        return 'Terminating...'
      case 'terminated':
        return 'Terminated'
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
    // Show resume button if paused or resuming, pause button if active or pausing
    const showPause = pipeline.status === 'active' || pipeline.status === 'pausing'
    const showResume = pipeline.status === 'paused' || pipeline.status === 'resuming'

    return (
      <>
        {showResume && renderActionButton('resume')}
        {renderActionButton('rename')}
        {renderActionButton('delete')}
        {showPause && renderActionButton('pause')}
        {/* Edit button disabled - functionality not implemented yet */}
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
              {/* Debug info */}
              {/* <div className="text-xs text-gray-500">
                Debug: status={pipeline.status}, actionState.isLoading={actionState.isLoading ? 'true' : 'false'},
                lastAction={actionState.lastAction}, health={health?.overall_status || 'none'}, recentAction=
                {recentActionRef.current?.action || 'none'}
              </div> */}
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
