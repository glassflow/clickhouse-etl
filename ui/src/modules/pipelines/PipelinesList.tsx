'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { useStore } from '@/src/store'
import { useRouter } from 'next/navigation'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { ModalResult as InputModalResult } from '@/src/components/common/InputModal'
import { saveConfiguration } from '@/src/utils/local-storage-config'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { Pipeline, ListPipelineConfig, PipelineError } from '@/src/types/pipeline'
import { PipelinesTable, TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { TableContextMenu } from './TableContextMenu'
import { CreateIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
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
  getPipeline,
} from '@/src/api/pipeline-api'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { countPipelinesBlockingCreation } from '@/src/utils/pipeline-actions'
import { useMultiplePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineState'
import { downloadPipelineConfig } from '@/src/utils/pipeline-download'
import { formatNumber } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'

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

  // NEW: Simple centralized state management
  const pipelineIds = useMemo(() => pipelines.map((p) => p.pipeline_id), [pipelines])

  // NEW: Get pipeline statuses from centralized state
  const pipelineStatuses = useMultiplePipelineState(pipelineIds)

  // NEW: Get operations interface
  const operations = usePipelineOperations()

  // NEW: Start monitoring these pipelines
  usePipelineMonitoring(pipelineIds)

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

  // Get effective status (from centralized state or fallback to pipeline data)
  const getEffectiveStatus = (pipeline: ListPipelineConfig): PipelineStatus => {
    return pipelineStatuses[pipeline.pipeline_id] || (pipeline.status as PipelineStatus) || 'active'
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

  const getBadgeLabel = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'pausing':
        return 'Pausing...'
      case 'paused':
        return 'Paused'
      case 'resuming':
        return 'Resuming...'
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

  const getStatusVariant = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'paused':
        return 'warning'
      case 'pausing':
        return 'warning'
      case 'resuming':
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
      key: 'health',
      header: 'Health',
      width: '1fr',
      align: 'left',
      render: (pipeline) => {
        const healthStatus = pipeline.health_status || 'stable'
        const dlqStats = pipeline.dlq_stats
        // const unconsumedEvents = dlqStats?.unconsumed_messages || 0

        const getStabilityVariant = (status: string) => {
          return status === 'stable' ? 'success' : 'error'
        }

        const getStabilityLabel = (status: string) => {
          return status === 'stable' ? 'Stable' : 'Unstable'
        }

        return (
          <div className="flex flex-row items-center justify-start gap-2 text-content">
            {healthStatus === 'stable' ? (
              <div className="w-3 h-3 rounded-full bg-green-500 items-center" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-red-500 items-center" />
            )}
            {getStabilityLabel(healthStatus)}
          </div>
        )
      },
    },
    {
      key: 'dlqStats',
      header: 'Events in DLQ',
      width: '1fr',
      align: 'left',
      render: (pipeline) => {
        const dlqStats = pipeline.dlq_stats
        const unconsumedEvents = dlqStats?.unconsumed_messages || 0
        // const totalEvents = dlqStats?.total_messages || 0

        // // Determine variant based on unconsumed events
        // const getDLQVariant = (unconsumed: number) => {
        //   if (unconsumed === 0) return 'success'
        //   if (unconsumed < 10) return 'warning'
        //   return 'error'
        // }

        return (
          <div className="flex flex-row items-center justify-start gap-1 text-content">
            {formatNumber(unconsumedEvents)}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      align: 'center',
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        return (
          <div className="flex flex-row items-center justify-center gap-2 text-content w-full">
            <Badge className="rounded-xl my-2 mx-4" variant={getStatusVariant(effectiveStatus)}>
              {getBadgeLabel(effectiveStatus)}
            </Badge>
          </div>
        )
      },
    },

    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '1fr',
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        return (
          <TableContextMenu
            pipelineStatus={effectiveStatus}
            isLoading={isPipelineLoading(pipeline.pipeline_id)}
            onPause={() => handlePause(pipeline)}
            onResume={() => handleResume(pipeline)}
            onEdit={() => handleEdit(pipeline)}
            onRename={() => handleRename(pipeline)}
            onStop={() => handleStop(pipeline)}
            onDelete={() => handleDelete(pipeline)}
            onDownload={() => handleDownload(pipeline)}
          />
        )
      },
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

    try {
      // Report operation to central system
      operations.reportResume(pipeline.pipeline_id)

      // Make API call
      await resumePipeline(pipeline.pipeline_id)

      // Track resume success
      analytics.pipeline.resumeSuccess({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
      })

      // Central system handles tracking and state updates
    } catch (error) {
      console.error('Failed to resume pipeline:', error)

      // Track resume failure
      analytics.pipeline.resumeFailed({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Revert optimistic update
      operations.revertOptimisticUpdate(pipeline.pipeline_id, 'paused')
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

    try {
      // Report operation to central system
      operations.reportDelete(pipeline.pipeline_id)

      // Make API call
      await deletePipeline(pipeline.pipeline_id)

      // Track delete success
      analytics.pipeline.deleteSuccess({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        processEvents: false,
      })

      // Remove pipeline from list and refresh to ensure it's gone from backend
      onRemovePipeline?.(pipeline.pipeline_id)
      setTimeout(() => onRefresh?.(), 1000)
    } catch (error) {
      console.error('Failed to delete pipeline:', error)

      // Track delete failure
      analytics.pipeline.deleteFailed({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        processEvents: false,
      })

      // Revert optimistic update
      const currentStatus = (pipeline.status as PipelineStatus) || 'active'
      operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
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

  const handleDownload = async (pipeline: ListPipelineConfig) => {
    try {
      await downloadPipelineConfig(pipeline)
    } catch (error) {
      console.error('Failed to download pipeline configuration:', error)
      // TODO: Add a toast notification to show the error to the user
    }
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
          healthMap={pipelineStatuses} // NEW: Use centralized statuses
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

          try {
            // Report operation to central system
            operations.reportPause(pauseSelectedPipeline.pipeline_id)

            // Make API call
            await pausePipeline(pauseSelectedPipeline.pipeline_id)

            // Track pause success
            analytics.pipeline.pauseSuccess({
              pipelineId: pauseSelectedPipeline.pipeline_id,
              pipelineName: pauseSelectedPipeline.name,
            })

            // Central system handles tracking and state updates
          } catch (error) {
            console.error('Failed to pause pipeline:', error)

            // Track pause failure
            analytics.pipeline.pauseFailed({
              pipelineId: pauseSelectedPipeline.pipeline_id,
              pipelineName: pauseSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            })

            // Revert optimistic update
            operations.revertOptimisticUpdate(pauseSelectedPipeline.pipeline_id, 'active')
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

          try {
            // Report operation to central system
            operations.reportStop(deleteSelectedPipeline.pipeline_id)

            // Make API call
            if (isGraceful) {
              await stopPipeline(deleteSelectedPipeline.pipeline_id)
            } else {
              await terminatePipeline(deleteSelectedPipeline.pipeline_id)
            }

            // Track stop success
            analytics.pipeline.deleteSuccess({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              processEvents: isGraceful,
            })

            // Central system handles tracking and state updates
          } catch (error) {
            console.error('Failed to stop pipeline:', error)

            // Track stop failure
            analytics.pipeline.deleteFailed({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              processEvents: isGraceful,
            })

            // Revert optimistic update
            const currentStatus = (deleteSelectedPipeline.status as PipelineStatus) || 'active'
            operations.revertOptimisticUpdate(deleteSelectedPipeline.pipeline_id, currentStatus)
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
