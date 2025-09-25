'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import { InputModal, ModalResult as InputModalResult } from '@/src/components/common/InputModal'
import { saveConfiguration } from '@/src/utils/local-storage-config'
import { isValidApiConfig } from '@/src/modules/pipelines/helpers'
import TrashIcon from '../../images/trash.svg'
import ModifyIcon from '../../images/modify.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { Feedback } from './Feedback'
import { Pipeline, ListPipelineConfig, PipelineError, getPipelineStatusFromState } from '@/src/types/pipeline'
import { PipelinesTable, TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { Badge } from '@/src/components/ui/badge'
import { TableContextMenu } from './TableContextMenu'
import { CreateIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { Checkbox } from '@/src/components/ui/checkbox'
import PausePipelineModal from './components/PausePipelineModal'
import StopPipelineModal from './components/StopPipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import { usePausePipelineModal, useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal } from './hooks'
import { PipelineStatus } from '@/src/types/pipeline'
import {
  pausePipeline,
  resumePipeline,
  renamePipeline,
  stopPipeline,
  terminatePipeline,
  deletePipeline,
} from '@/src/api/pipeline-api'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { countPipelinesBlockingCreation } from '@/src/utils/pipeline-actions'
import { startPauseStatusPolling } from './utils/progressiveStatusPolling'
// TEMPORARILY DISABLED: Health monitoring imports
// import { useMultiplePipelineHealth } from '@/src/hooks/usePipelineHealth'
// import { getHealthStatusDisplayText } from '@/src/api/pipeline-health'

type PipelinesListProps = {
  pipelines: ListPipelineConfig[]
  onRefresh?: () => Promise<void>
  onUpdatePipelineStatus?: (pipelineId: string, status: PipelineStatus) => void
  onUpdatePipelineName?: (pipelineId: string, newName: string) => void
  onRemovePipeline?: (pipelineId: string) => void
}

export function PipelinesList({
  pipelines,
  onRefresh,
  onUpdatePipelineStatus,
  onUpdatePipelineName,
  onRemovePipeline,
}: PipelinesListProps) {
  const analytics = useJourneyAnalytics()
  const { coreStore, resetAllPipelineState } = useStore()
  const { pipelineId, setPipelineId } = coreStore
  const [status, setStatus] = useState<PipelineStatus>('active')
  const [error, setError] = useState<string | null>(null)
  const {
    isRenameModalVisible,
    selectedPipeline: renameSelectedPipeline,
    openRenameModal,
    closeRenameModal,
  } = useRenamePipelineModal()
  const {
    isStopModalVisible,
    selectedPipeline: deleteSelectedPipeline,
    openStopModal,
    closeStopModal,
  } = useStopPipelineModal()
  const {
    isPauseModalVisible,
    selectedPipeline: pauseSelectedPipeline,
    openPauseModal,
    closePauseModal,
  } = usePausePipelineModal()
  const {
    isEditModalVisible,
    selectedPipeline: editSelectedPipeline,
    openEditModal,
    closeEditModal,
  } = useEditPipelineModal()
  const { isFeatureDisabled, isDocker, isLocal } = usePlatformDetection()
  const [isGracefulStop, setIsGracefulStop] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showPipelineLimitModal, setShowPipelineLimitModal] = useState(false)

  // Track loading operations for individual pipelines
  const [pipelineOperations, setPipelineOperations] = useState<
    Record<
      string,
      {
        isLoading: boolean
        operation: 'pause' | 'resume' | 'stop' | 'delete' | 'rename' | 'edit' | null
      }
    >
  >({})

  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // TEMPORARILY DISABLED: Multiple pipeline health monitoring for real-time status updates
  // TODO: Re-enable after fixing polling performance issues
  // const pipelineIds = useMemo(() => pipelines.map((p) => p.pipeline_id), [pipelines])
  //
  // const { healthMap } = useMultiplePipelineHealth({
  //   pipelineIds,
  //   enabled: true,
  //   pollingInterval: 15000, // 15 seconds for list view - conservative interval
  //   onStatusChange: (pipelineId, newStatus, previousStatus) => {
  //     console.log(`Pipeline list: ${pipelineId} status changed: ${previousStatus} → ${newStatus}`)
  //   },
  //   onError: (pipelineId, error) => {
  //     console.log(`Pipeline list: Health check error for ${pipelineId}:`, error)
  //   },
  // })

  // Use empty healthMap for now - fall back to static pipeline status
  const healthMap = {}

  // Helper functions to manage pipeline operation state
  const setPipelineLoading = (
    pipelineId: string,
    operation: 'pause' | 'resume' | 'stop' | 'delete' | 'rename' | 'edit',
  ) => {
    setPipelineOperations((prev) => ({
      ...prev,
      [pipelineId]: { isLoading: true, operation },
    }))
  }

  const clearPipelineLoading = (pipelineId: string) => {
    setPipelineOperations((prev) => ({
      ...prev,
      [pipelineId]: { isLoading: false, operation: null },
    }))
  }

  const isPipelineLoading = (pipelineId: string) => {
    return pipelineOperations[pipelineId]?.isLoading || false
  }

  const getPipelineOperation = (pipelineId: string) => {
    return pipelineOperations[pipelineId]?.operation || null
  }

  // Count pipelines that block new pipeline creation (active or paused)
  const activePipelinesCount = useMemo(() => {
    // Count pipelines that are active or paused as blocking new pipeline creation
    // Only terminated or deleted pipelines allow new pipeline creation
    return countPipelinesBlockingCreation(pipelines)
  }, [pipelines])

  // Check if new pipeline creation should show limitation modal
  const shouldShowPipelineLimitModal = useMemo(() => {
    // Only show modal for local and docker platforms
    if (!isDocker && !isLocal) {
      return false
    }

    // Show modal if there are active or paused pipelines blocking new creation
    return activePipelinesCount > 0
  }, [isDocker, isLocal, activePipelinesCount])

  // Check if feedback was already submitted
  useEffect(() => {
    // Track page view when component loads
    analytics.page.pipelines({})
  }, [])

  // Check screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const handleModifyAndRestart = () => {
    openRenameModal()
  }

  const handleModifyModalComplete = async (result: string, configName: string, operation: string) => {
    closeRenameModal()

    // Save configuration if the user chose to do so and provided a name
    if (result === InputModalResult.SUBMIT && configName) {
      try {
        saveConfiguration(
          configName,
          `Pipeline configuration saved before modification on ${new Date().toLocaleString()}`,
        )
      } catch (error) {
        console.error('Failed to save configuration:', error)
      }
    }

    // Reset pipeline state and navigate to home regardless of save choice
    if (result === InputModalResult.SUBMIT) {
      try {
        // Track successful pipeline modification
        analytics.pipeline.modifyClicked({
          pipelineId,
          configSaved: !!configName,
          status: 'success',
        })

        await terminatePipeline(pipelineId)
        setStatus('stopped')
        setError(null)
        resetAllPipelineState('', true)

        // Track successful pipeline modification
        analytics.pipeline.modifySuccess({})

        router.push('/home')
      } catch (err) {
        const error = err as PipelineError
        setStatus('failed')
        setError(error.message)

        // Track failed pipeline modification
        analytics.pipeline.modifyFailed({
          error: error.message,
        })
      }
    }
  }

  const getStatusClass = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'text-[var(--color-foreground-success)]'
      case 'paused':
      case 'pausing':
        return 'text-[var(--color-foreground-warning)]'
      case 'stopped':
      case 'stopping':
      case 'failed':
        return 'text-[var(--color-foreground-error)]'
      default:
        return ''
    }
  }

  const getStatusText = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'Pipeline is active'
      case 'pausing':
        return 'Pipeline is pausing'
      case 'paused':
        return 'Pipeline is paused'
      case 'stopping':
        return 'Pipeline is stopping'
      case 'stopped':
        return 'Pipeline is stopped'
      case 'failed':
        return 'Pipeline has failed'
      default:
        return 'Unknown status'
    }
  }

  const getBadgeLabel = (status: PipelineStatus, pipelineId?: string) => {
    // TEMPORARILY DISABLED: Health monitoring - use static status only
    // const healthData = pipelineId ? healthMap[pipelineId] : null
    // if (healthData) {
    //   return getHealthStatusDisplayText(healthData.overall_status)
    // }

    // Use static status from initial pipeline data
    switch (status) {
      case 'active':
        return 'Active'
      case 'pausing':
        return 'Pausing...'
      case 'paused':
        return 'Paused'
      case 'stopping':
        return 'Stopping...'
      case 'stopped':
        return 'Stopped'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown status'
    }
  }

  // Define table columns for desktop
  const columns: TableColumn<ListPipelineConfig>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      render: (pipeline) => {
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        const operation = getPipelineOperation(pipeline.pipeline_id)

        return (
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-1">
                <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
                {/* <span className="text-xs text-blue-600">
                  {operation === 'pause' && 'Pausing...'}
                  {operation === 'resume' && 'Resuming...'}
                  {operation === 'delete' && 'Deleting...'}
                  {operation === 'rename' && 'Renaming...'}
                  {operation === 'edit' && 'Pausing...'}
                </span> */}
              </div>
            )}
            <span className="font-medium">{pipeline.name}</span>
          </div>
        )
      },
    },
    {
      key: 'operations',
      header: 'Transformation',
      width: '2fr',
      render: (pipeline) => pipeline.transformation_type || 'None',
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      render: (pipeline) => {
        const getStatusVariant = (status: string, pipelineId?: string) => {
          // TEMPORARILY DISABLED: Health monitoring - use static status only
          // const healthData = pipelineId ? healthMap[pipelineId] : null
          // const effectiveStatus = healthData?.overall_status || status

          switch (status) {
            case 'active':
              return 'success'
            case 'paused':
              return 'warning'
            case 'pausing':
              return 'warning'
            case 'stopping':
              return 'warning'
            case 'stopped':
              return 'secondary'
            case 'failed':
              return 'error'
            default:
              return 'default'
          }
        }

        return (
          <Badge
            className="rounded-xl my-2 mx-4"
            variant={getStatusVariant((pipeline.status as PipelineStatus) || 'no_configuration', pipeline.pipeline_id)}
          >
            {getBadgeLabel((pipeline.status as PipelineStatus) || 'no_configuration', pipeline.pipeline_id)}
          </Badge>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '1fr',
      render: (pipeline) => (
        <TableContextMenu
          pipelineStatus={(pipeline.status as PipelineStatus) || 'no_configuration'}
          isLoading={isPipelineLoading(pipeline.pipeline_id)}
          onPause={() => handlePause(pipeline)}
          onResume={() => handleResume(pipeline)}
          onEdit={() => handleEdit(pipeline)}
          onRename={() => handleRename(pipeline)}
          onStop={() => handleStop(pipeline)}
          onDelete={() => handleDelete(pipeline)}
        />
      ),
    },
  ]

  // Context menu handlers
  const handlePause = (pipeline: ListPipelineConfig) => {
    openPauseModal(pipeline)
  }

  const handleResume = async (pipeline: ListPipelineConfig) => {
    // Track resume clicked
    analytics.pipeline.resumeClicked({
      pipelineId: pipeline.pipeline_id,
      pipelineName: pipeline.name,
      currentStatus: pipeline.status,
    })

    setPipelineLoading(pipeline.pipeline_id, 'resume')

    // Keep current status during resume operation - loading spinner will show progress
    const currentStatus = (pipeline.status as PipelineStatus) || 'no_configuration'
    // Don't change status optimistically for resume - wait for completion

    try {
      await resumePipeline(pipeline.pipeline_id)

      // Track resume success
      analytics.pipeline.resumeSuccess({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
      })

      // Update status to final 'active' state after successful resume
      onUpdatePipelineStatus?.(pipeline.pipeline_id, 'active')

      // Skip immediate refresh for resume - backend status transitions can be slow
    } catch (error) {
      console.error('Failed to resume pipeline:', error)

      // Track resume failure
      analytics.pipeline.resumeFailed({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Revert optimistic update on error
      onUpdatePipelineStatus?.(pipeline.pipeline_id, currentStatus)
    } finally {
      clearPipelineLoading(pipeline.pipeline_id)
    }
  }

  const handleEdit = (pipeline: ListPipelineConfig) => {
    openEditModal(pipeline)
  }

  const handleRename = (pipeline: ListPipelineConfig) => {
    openRenameModal(pipeline)
  }

  const handleStop = (pipeline: ListPipelineConfig) => {
    openStopModal(pipeline)
  }

  const handleDelete = async (pipeline: ListPipelineConfig) => {
    // Track delete clicked
    analytics.pipeline.deleteClicked({
      pipelineId: pipeline.pipeline_id,
      pipelineName: pipeline.name,
      currentStatus: pipeline.status,
      processEvents: false, // Delete doesn't process events
    })

    setPipelineLoading(pipeline.pipeline_id, 'delete')

    // Optimistically update status to 'stopped'
    onUpdatePipelineStatus?.(pipeline.pipeline_id, 'stopped')

    try {
      await deletePipeline(pipeline.pipeline_id)
      // Track delete success
      analytics.pipeline.deleteSuccess({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        processEvents: false,
      })

      // Remove pipeline from list and refresh to ensure it's gone from backend
      onRemovePipeline?.(pipeline.pipeline_id)
      // For delete, we do want to refresh to ensure pipeline is actually removed
      setTimeout(async () => {
        await onRefresh?.()
      }, 1000)
    } catch (error) {
      console.error('Failed to delete pipeline:', error)

      // Track delete failure
      analytics.pipeline.deleteFailed({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        processEvents: false,
      })

      // Revert optimistic update on error
      onUpdatePipelineStatus?.(pipeline.pipeline_id, (pipeline.status as PipelineStatus) || 'no_configuration')
    } finally {
      clearPipelineLoading(pipeline.pipeline_id)
    }
  }

  const handleCreate = () => {
    // Check if we're on a platform with limitations and there are active pipelines
    if (shouldShowPipelineLimitModal) {
      setShowPipelineLimitModal(true)
      return
    }

    router.push('/home')
  }

  const handlePipelineLimitModalComplete = (result: string) => {
    setShowPipelineLimitModal(false)

    if (result === ModalResult.YES) {
      // Stay on pipelines page to manage active pipelines
      // The user can pause/delete the active pipeline from here
    }
  }

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Header with title and button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Pipelines</h1>
        <Button variant="default" className="btn-primary btn-text" onClick={handleCreate}>
          <CreateIcon className="action-icon" size={16} />
          New Pipeline
        </Button>
      </div>

      {/* Desktop/Tablet Table */}
      <div className="hidden md:block">
        <PipelinesTable
          data={pipelines}
          columns={columns}
          emptyMessage="No pipelines found. Create your first pipeline to get started."
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden">
        <MobilePipelinesList
          pipelines={pipelines}
          healthMap={healthMap}
          onPause={handlePause}
          onResume={handleResume}
          onEdit={handleEdit}
          onRename={handleRename}
          onStop={handleStop}
          onDelete={handleDelete}
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
          isPipelineLoading={isPipelineLoading}
          getPipelineOperation={getPipelineOperation}
        />
      </div>

      <PausePipelineModal
        visible={isPauseModalVisible}
        onOk={async () => {
          if (!pauseSelectedPipeline) return

          // Track pause clicked
          analytics.pipeline.pauseClicked({
            pipelineId: pauseSelectedPipeline.pipeline_id,
            pipelineName: pauseSelectedPipeline.name,
            currentStatus: pauseSelectedPipeline.status,
          })

          closePauseModal() // Close modal immediately
          setPipelineLoading(pauseSelectedPipeline.pipeline_id, 'pause')

          // Optimistically update status to 'pausing'
          onUpdatePipelineStatus?.(pauseSelectedPipeline.pipeline_id, 'pausing')

          try {
            await pausePipeline(pauseSelectedPipeline.pipeline_id)
            // Track pause success
            analytics.pipeline.pauseSuccess({
              pipelineId: pauseSelectedPipeline.pipeline_id,
              pipelineName: pauseSelectedPipeline.name,
            })

            // Don't update to 'paused' immediately - pause request submitted but actual pause may take time
            // Keep showing 'pausing' status until backend confirms the pipeline is actually paused
            // Start progressive polling to detect when pause actually completes
            const pollingController = startPauseStatusPolling(
              pauseSelectedPipeline.pipeline_id,
              async () => {
                try {
                  await onRefresh?.()
                } catch (error) {
                  console.error('Failed to refresh pipeline status:', error)
                }
              },
              () => {
                console.log('Pause polling timed out - pipeline may still be processing messages')
              },
            )
          } catch (error) {
            // Track pause failure
            analytics.pipeline.pauseFailed({
              pipelineId: pauseSelectedPipeline.pipeline_id,
              pipelineName: pauseSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            })

            // Revert optimistic update on error
            onUpdatePipelineStatus?.(pauseSelectedPipeline.pipeline_id, 'active')
          } finally {
            clearPipelineLoading(pauseSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closePauseModal()
        }}
      />
      <RenamePipelineModal
        visible={isRenameModalVisible}
        currentName={renameSelectedPipeline?.name || ''}
        onOk={async (newName) => {
          if (!renameSelectedPipeline || !newName) return

          // Track rename clicked
          analytics.pipeline.renameClicked({
            pipelineId: renameSelectedPipeline.pipeline_id,
            pipelineName: renameSelectedPipeline.name,
            newName: newName,
          })

          closeRenameModal() // Close modal immediately
          setPipelineLoading(renameSelectedPipeline.pipeline_id, 'rename')

          // Optimistically update the name
          const oldName = renameSelectedPipeline.name
          onUpdatePipelineName?.(renameSelectedPipeline.pipeline_id, newName)

          try {
            await renamePipeline(renameSelectedPipeline.pipeline_id, newName)
            // Track rename success
            analytics.pipeline.renameSuccess({
              pipelineId: renameSelectedPipeline.pipeline_id,
              oldName: oldName,
              newName: newName,
            })

            // Skip immediate refresh for rename - optimistic update is sufficient
          } catch (error) {
            console.error('Failed to rename pipeline:', error)

            // Track rename failure
            analytics.pipeline.renameFailed({
              pipelineId: renameSelectedPipeline.pipeline_id,
              pipelineName: oldName,
              newName: newName,
              error: error instanceof Error ? error.message : 'Unknown error',
            })

            // Revert optimistic update on error
            onUpdatePipelineName?.(renameSelectedPipeline.pipeline_id, oldName)
          } finally {
            clearPipelineLoading(renameSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closeRenameModal()
        }}
      />
      <EditPipelineModal
        visible={isEditModalVisible}
        onOk={async () => {
          if (!editSelectedPipeline) return

          // Track edit clicked
          analytics.pipeline.editClicked({
            pipelineId: editSelectedPipeline.pipeline_id,
            pipelineName: editSelectedPipeline.name,
            currentStatus: editSelectedPipeline.status,
          })

          closeEditModal() // Close modal immediately
          setPipelineLoading(editSelectedPipeline.pipeline_id, 'edit')

          try {
            // Check if pipeline is active and needs to be paused first
            if (editSelectedPipeline.status === 'active') {
              // Optimistically update status to 'pausing'
              onUpdatePipelineStatus?.(editSelectedPipeline.pipeline_id, 'pausing')

              // Pause the pipeline first
              await pausePipeline(editSelectedPipeline.pipeline_id)

              // Update status to final 'paused' state after successful pause for edit
              onUpdatePipelineStatus?.(editSelectedPipeline.pipeline_id, 'paused')

              // Skip refresh since we're navigating to edit page immediately
            } else {
              console.log('Pipeline already paused, proceeding to edit:', editSelectedPipeline.pipeline_id)
            }

            // Track edit success (preparation completed)
            analytics.pipeline.editSuccess({
              pipelineId: editSelectedPipeline.pipeline_id,
              pipelineName: editSelectedPipeline.name,
              wasPausedForEdit: editSelectedPipeline.status === 'active',
            })

            // Navigate to pipeline details page for editing
            router.push(`/pipelines/${editSelectedPipeline.pipeline_id}`)
          } catch (error) {
            console.error('Failed to prepare pipeline for edit:', error)

            // Track edit failure
            analytics.pipeline.editFailed({
              pipelineId: editSelectedPipeline.pipeline_id,
              pipelineName: editSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              currentStatus: editSelectedPipeline.status,
            })

            // Revert optimistic update on error
            onUpdatePipelineStatus?.(
              editSelectedPipeline.pipeline_id,
              editSelectedPipeline.status || 'no_configuration',
            )
          } finally {
            clearPipelineLoading(editSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closeEditModal()
        }}
      />
      <StopPipelineModal
        visible={isStopModalVisible}
        onOk={async (isGraceful) => {
          if (!deleteSelectedPipeline) return

          // Track stop clicked
          analytics.pipeline.deleteClicked({
            pipelineId: deleteSelectedPipeline.pipeline_id,
            pipelineName: deleteSelectedPipeline.name,
            currentStatus: deleteSelectedPipeline.status,
            processEvents: isGraceful, // Keep for backward compatibility with analytics
          })

          closeStopModal() // Close modal immediately
          setPipelineLoading(deleteSelectedPipeline.pipeline_id, 'delete')

          // Optimistically update status to transitional state
          onUpdatePipelineStatus?.(deleteSelectedPipeline.pipeline_id, 'stopping')

          try {
            if (isGraceful) {
              // Graceful stop - process remaining events
              await stopPipeline(deleteSelectedPipeline.pipeline_id)
            } else {
              // Ungraceful stop - terminate immediately
              await terminatePipeline(deleteSelectedPipeline.pipeline_id)
            }

            // Track stop success
            analytics.pipeline.deleteSuccess({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              processEvents: isGraceful, // Keep for backward compatibility with analytics
            })

            onUpdatePipelineStatus?.(deleteSelectedPipeline.pipeline_id, 'stopped')

            // Skip refresh for successful stop operations to avoid overwriting correct status
            // The optimistic update is reliable since the API call succeeded
          } catch (error) {
            console.error('Failed to stop pipeline:', error)

            // Track stop failure
            analytics.pipeline.deleteFailed({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              processEvents: isGraceful, // Keep for backward compatibility with analytics
            })

            // Revert optimistic update on error
            onUpdatePipelineStatus?.(
              deleteSelectedPipeline.pipeline_id,
              deleteSelectedPipeline.status || 'no_configuration',
            )
          } finally {
            clearPipelineLoading(deleteSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closeStopModal()
        }}
        callback={(result) => {
          setIsGracefulStop(result)
        }}
      />

      <InfoModal
        visible={showPipelineLimitModal}
        title="Pipeline Limit Reached"
        description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active or paused pipelines.`}
        okButtonText="Manage Pipelines"
        cancelButtonText="Cancel"
        onComplete={handlePipelineLimitModalComplete}
      />
    </div>
  )
}

const ActiveChip = ({ status }: { status: Pipeline['status'] }) => {
  return <span className="chip-positive">{status}</span>
}
