'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ListPipelineConfig } from '@/src/types/pipeline'
import type { PipelineStatus } from '@/src/types/pipeline'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { notify } from '@/src/notifications'
import {
  resumePipeline,
  renamePipeline,
  stopPipeline,
  terminatePipeline,
  deletePipeline,
  updatePipelineMetadata,
} from '@/src/api/pipeline-api'
import { downloadPipelineConfig } from '@/src/utils/pipeline-download'

type PipelineOperation = 'stop' | 'resume' | 'terminate' | 'delete' | 'rename' | 'edit' | 'tags'

type PipelineOperationsState = Record<string, { isLoading: boolean; operation: PipelineOperation | null }>

export interface UsePipelineListOperationsProps {
  operations: ReturnType<typeof import('@/src/hooks/usePipelineStateAdapter').usePipelineOperations>
  analytics: ReturnType<typeof import('@/src/hooks/useJourneyAnalytics').useJourneyAnalytics>
  router: ReturnType<typeof useRouter>
  getEffectiveStatus: (pipeline: ListPipelineConfig) => PipelineStatus
  onUpdatePipelineStatus?: (pipelineId: string, status: PipelineStatus) => void
  onUpdatePipelineName?: (pipelineId: string, newName: string) => void
  onRemovePipeline?: (pipelineId: string) => void
  onRefresh?: () => Promise<void>
  openStopModal: (pipeline?: ListPipelineConfig | null) => void
  openRenameModal: (pipeline?: ListPipelineConfig | null) => void
  openEditModal: (pipeline?: ListPipelineConfig | null) => void
  openTerminateModal: (pipeline?: ListPipelineConfig | null) => void
  onOpenTagsModal: (pipeline: ListPipelineConfig) => void
}

export function usePipelineListOperations(props: UsePipelineListOperationsProps) {
  const {
    operations,
    analytics,
    router,
    getEffectiveStatus,
    onUpdatePipelineStatus,
    onUpdatePipelineName,
    onRemovePipeline,
    onRefresh,
    openStopModal,
    openRenameModal,
    openEditModal,
    openTerminateModal,
    onOpenTagsModal,
  } = props

  const [pipelineOperations, setPipelineOperationsState] = useState<PipelineOperationsState>({})

  const setPipelineLoading = useCallback((pipelineId: string, operation: PipelineOperation) => {
    setPipelineOperationsState((prev) => ({
      ...prev,
      [pipelineId]: { isLoading: true, operation },
    }))
  }, [])

  const clearPipelineLoading = useCallback((pipelineId: string) => {
    setPipelineOperationsState((prev) => ({
      ...prev,
      [pipelineId]: { isLoading: false, operation: null },
    }))
  }, [])

  const isPipelineLoading = useCallback(
    (pipelineId: string) => pipelineOperations[pipelineId]?.isLoading ?? false,
    [pipelineOperations],
  )

  const getPipelineOperation = useCallback(
    (pipelineId: string) => pipelineOperations[pipelineId]?.operation ?? null,
    [pipelineOperations],
  )

  const handleStop = useCallback((pipeline: ListPipelineConfig) => openStopModal(pipeline), [openStopModal])

  const handleResume = useCallback(
    async (pipeline: ListPipelineConfig) => {
      analytics.pipeline.resumeClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        currentStatus: pipeline.status,
      })
      setPipelineLoading(pipeline.pipeline_id, 'resume')
      try {
        operations.reportResume(pipeline.pipeline_id)
        await resumePipeline(pipeline.pipeline_id)
        sessionStorage.removeItem('lastHydratedPipeline')
        analytics.pipeline.resumeSuccess({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
        })
      } catch (error) {
        handleApiError(error, {
          operation: 'resume',
          pipelineName: pipeline.name,
        })
        analytics.pipeline.resumeFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        operations.revertOptimisticUpdate(pipeline.pipeline_id, 'stopped')
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [analytics, operations, setPipelineLoading, clearPipelineLoading],
  )

  const handleEdit = useCallback(
    (pipeline: ListPipelineConfig) => {
      const effectiveStatus = getEffectiveStatus(pipeline)
      if (effectiveStatus === 'active') {
        openEditModal(pipeline)
        return
      }
      router.push(`/pipelines/${pipeline.pipeline_id}`)
    },
    [getEffectiveStatus, openEditModal, router],
  )

  const handleRename = useCallback((pipeline: ListPipelineConfig) => openRenameModal(pipeline), [openRenameModal])

  const handleTerminate = useCallback(
    (pipeline: ListPipelineConfig) => openTerminateModal(pipeline),
    [openTerminateModal],
  )

  const handleDelete = useCallback(
    async (pipeline: ListPipelineConfig) => {
      analytics.pipeline.deleteClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        currentStatus: pipeline.status,
        processEvents: false,
      })
      setPipelineLoading(pipeline.pipeline_id, 'delete')
      try {
        operations.reportDelete(pipeline.pipeline_id)
        await deletePipeline(pipeline.pipeline_id)
        analytics.pipeline.deleteSuccess({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          processEvents: false,
        })
        onRemovePipeline?.(pipeline.pipeline_id)
        setTimeout(() => onRefresh?.(), 1000)
      } catch (error) {
        handleApiError(error, {
          operation: 'delete',
          pipelineName: pipeline.name,
          retryFn: () => handleDelete(pipeline),
        })
        analytics.pipeline.deleteFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          processEvents: false,
        })
        const currentStatus = (pipeline.status as PipelineStatus) || 'active'
        operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [analytics, operations, onRemovePipeline, onRefresh, setPipelineLoading, clearPipelineLoading],
  )

  const handleDownload = useCallback(async (pipeline: ListPipelineConfig) => {
    try {
      await downloadPipelineConfig(pipeline)
    } catch (error) {
      notify({
        variant: 'error',
        title: 'Failed to download pipeline configuration.',
        description: 'The configuration file could not be downloaded.',
        action: { label: 'Try again', onClick: () => handleDownload(pipeline) },
        reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
        channel: 'toast',
      })
    }
  }, [])

  const handleManageTags = useCallback((pipeline: ListPipelineConfig) => onOpenTagsModal(pipeline), [onOpenTagsModal])

  const handleStopConfirm = useCallback(
    async (pipeline: ListPipelineConfig) => {
      analytics.pipeline.pauseClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        currentStatus: pipeline.status,
      })
      setPipelineLoading(pipeline.pipeline_id, 'stop')
      try {
        operations.reportStop(pipeline.pipeline_id)
        await stopPipeline(pipeline.pipeline_id)
        analytics.pipeline.pauseSuccess({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
        })
      } catch (error) {
        handleApiError(error, {
          operation: 'stop',
          pipelineName: pipeline.name,
          retryFn: async () => {
            try {
              setPipelineLoading(pipeline.pipeline_id, 'stop')
              operations.reportStop(pipeline.pipeline_id)
              await stopPipeline(pipeline.pipeline_id)
              analytics.pipeline.pauseSuccess({
                pipelineId: pipeline.pipeline_id,
                pipelineName: pipeline.name,
              })
            } catch (retryError) {
              handleApiError(retryError, {
                operation: 'stop',
                pipelineName: pipeline.name,
              })
            } finally {
              clearPipelineLoading(pipeline.pipeline_id)
            }
          },
        })
        analytics.pipeline.pauseFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        operations.revertOptimisticUpdate(pipeline.pipeline_id, 'active')
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [analytics, operations, setPipelineLoading, clearPipelineLoading],
  )

  const handleRenameConfirm = useCallback(
    async (pipeline: ListPipelineConfig, newName: string) => {
      analytics.pipeline.renameClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        newName,
      })
      setPipelineLoading(pipeline.pipeline_id, 'rename')
      const oldName = pipeline.name
      onUpdatePipelineName?.(pipeline.pipeline_id, newName)
      try {
        await renamePipeline(pipeline.pipeline_id, newName)
        analytics.pipeline.renameSuccess({
          pipelineId: pipeline.pipeline_id,
          oldName,
          newName,
        })
      } catch (error) {
        handleApiError(error, {
          operation: 'rename',
          pipelineName: pipeline.name,
          retryFn: () => openRenameModal(pipeline),
        })
        analytics.pipeline.renameFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: oldName,
          newName,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        onUpdatePipelineName?.(pipeline.pipeline_id, oldName)
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [analytics, onUpdatePipelineName, openRenameModal, setPipelineLoading, clearPipelineLoading],
  )

  const handleEditConfirm = useCallback(
    async (pipeline: ListPipelineConfig) => {
      analytics.pipeline.editClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        currentStatus: pipeline.status,
      })
      setPipelineLoading(pipeline.pipeline_id, 'edit')
      try {
        operations.reportStop(pipeline.pipeline_id)
        onUpdatePipelineStatus?.(pipeline.pipeline_id, 'stopping')
        await stopPipeline(pipeline.pipeline_id)
        onUpdatePipelineStatus?.(pipeline.pipeline_id, 'stopped')
        analytics.pipeline.editSuccess({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          wasPausedForEdit: true,
        })
        router.push(`/pipelines/${pipeline.pipeline_id}`)
      } catch (error) {
        handleApiError(error, {
          operation: 'edit',
          pipelineName: pipeline.name,
          retryFn: () => handleEdit(pipeline),
          onMustBeStopped: () => handleStop(pipeline),
        })
        analytics.pipeline.editFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          currentStatus: pipeline.status,
        })
        operations.revertOptimisticUpdate(pipeline.pipeline_id, 'active')
        onUpdatePipelineStatus?.(pipeline.pipeline_id, (pipeline.status as PipelineStatus) || 'stopped')
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [
      analytics,
      operations,
      onUpdatePipelineStatus,
      router,
      setPipelineLoading,
      clearPipelineLoading,
      handleEdit,
      handleStop,
    ],
  )

  const handleTerminateConfirm = useCallback(
    async (pipeline: ListPipelineConfig) => {
      analytics.pipeline.deleteClicked({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        currentStatus: pipeline.status,
        processEvents: false,
      })
      setPipelineLoading(pipeline.pipeline_id, 'delete')
      try {
        operations.reportTerminate(pipeline.pipeline_id)
        await terminatePipeline(pipeline.pipeline_id)
        analytics.pipeline.deleteSuccess({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          processEvents: false,
        })
      } catch (error) {
        handleApiError(error, {
          operation: 'terminate',
          pipelineName: pipeline.name,
        })
        analytics.pipeline.deleteFailed({
          pipelineId: pipeline.pipeline_id,
          pipelineName: pipeline.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          processEvents: false,
        })
        const currentStatus = (pipeline.status as PipelineStatus) || 'active'
        operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
      } finally {
        clearPipelineLoading(pipeline.pipeline_id)
      }
    },
    [analytics, operations, setPipelineLoading, clearPipelineLoading],
  )

  return {
    setPipelineLoading,
    clearPipelineLoading,
    isPipelineLoading,
    getPipelineOperation,
    handleStop,
    handleResume,
    handleEdit,
    handleRename,
    handleTerminate,
    handleDelete,
    handleDownload,
    handleManageTags,
    handleStopConfirm,
    handleRenameConfirm,
    handleEditConfirm,
    handleTerminateConfirm,
  }
}
