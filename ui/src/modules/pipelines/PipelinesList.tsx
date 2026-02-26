'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { PipelinesTable } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { CreateIcon, FilterIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import StopPipelineModal from './components/StopPipelineModal'
import TerminatePipelineModal from './components/TerminatePipelineModal'
import DeletePipelineModal from './components/DeletePipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import PipelineTagsModal from './components/PipelineTagsModal'
import { PipelineFilterMenu, FilterState } from './PipelineFilterMenu'
import { FilterChip } from './FilterChip'
import { useFiltersFromUrl } from './utils/filterUrl'
import { useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal, useTerminatePipelineModal } from './hooks'
import { PipelineStatus } from '@/src/types/pipeline'
import { notify } from '@/src/notifications'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { updatePipelineMetadata } from '@/src/api/pipeline-api'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { useMultiplePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineStateAdapter'
import { getPipelineListColumns } from './columns/pipelineListColumns'
import { usePipelineListOperations } from './usePipelineListOperations'

type PipelinesListProps = {
  pipelines: ListPipelineConfig[]
  onRefresh?: () => Promise<void>
  onUpdatePipelineStatus?: (pipelineId: string, status: PipelineStatus) => void
  onUpdatePipelineName?: (pipelineId: string, newName: string) => void
  onRemovePipeline?: (pipelineId: string) => void
  onUpdatePipelineTags?: (pipelineId: string, tags: string[]) => void
}

export function PipelinesList({
  pipelines,
  onRefresh,
  onUpdatePipelineStatus,
  onUpdatePipelineName,
  onRemovePipeline,
  onUpdatePipelineTags,
}: PipelinesListProps) {
  const analytics = useJourneyAnalytics()
  const {
    isRenameModalVisible,
    selectedPipeline: renameSelectedPipeline,
    openRenameModal,
    closeRenameModal,
  } = useRenamePipelineModal()
  const {
    isTerminateModalVisible,
    selectedPipeline: deleteSelectedPipeline,
    openTerminateModal,
    closeTerminateModal,
  } = useTerminatePipelineModal()
  const {
    isStopModalVisible,
    selectedPipeline: stopSelectedPipeline,
    openStopModal,
    closeStopModal,
  } = useStopPipelineModal()
  const {
    isEditModalVisible,
    selectedPipeline: editSelectedPipeline,
    openEditModal,
    closeEditModal,
  } = useEditPipelineModal()
  const { isDocker, isLocal } = usePlatformDetection()
  const [showPipelineLimitModal, setShowPipelineLimitModal] = useState(false)

  const [filters, setFilters] = useFiltersFromUrl()
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterButtonRef = React.useRef<HTMLButtonElement>(null)

  const [tagsModalPipeline, setTagsModalPipeline] = useState<ListPipelineConfig | null>(null)
  const [isTagsModalVisible, setIsTagsModalVisible] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [deleteConfirmPipeline, setDeleteConfirmPipeline] = useState<ListPipelineConfig | null>(null)
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false)

  const router = useRouter()
  const pipelineIds = useMemo(() => pipelines.map((p) => p.pipeline_id), [pipelines])
  const pipelineStatuses = useMultiplePipelineState(pipelineIds)
  const operations = usePipelineOperations()
  usePipelineMonitoring(pipelineIds)

  const getEffectiveStatus = useCallback(
    (pipeline: ListPipelineConfig): PipelineStatus =>
      pipelineStatuses[pipeline.pipeline_id] ?? (pipeline.status as PipelineStatus) ?? 'active',
    [pipelineStatuses],
  )

  const onOpenTagsModal = useCallback((pipeline: ListPipelineConfig) => {
    setTagsModalPipeline(pipeline)
    setIsTagsModalVisible(true)
  }, [])

  const listOps = usePipelineListOperations({
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
  })

  const {
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
  } = listOps

  const openDeleteConfirmModal = useCallback((pipeline: ListPipelineConfig) => {
    setDeleteConfirmPipeline(pipeline)
    setIsDeleteConfirmVisible(true)
  }, [])

  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteConfirmPipeline(null)
    setIsDeleteConfirmVisible(false)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmPipeline) return
    closeDeleteConfirmModal()
    await handleDelete(deleteConfirmPipeline)
  }, [deleteConfirmPipeline, closeDeleteConfirmModal, handleDelete])

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    pipelines.forEach((pipeline) => {
      pipeline.metadata?.tags?.forEach((tag) => {
        const normalized = (tag || '').trim()
        if (normalized) {
          tagSet.add(normalized)
        }
      })
    })
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  }, [pipelines])

  // Filter pipelines based on active filters
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((pipeline) => {
      // Apply status filter
      if (filters.status.length > 0) {
        const effectiveStatus = getEffectiveStatus(pipeline)
        if (!filters.status.includes(effectiveStatus)) {
          return false
        }
      }

      // Apply health filter
      if (filters.health.length > 0) {
        const healthStatus = pipeline.health_status || 'stable'
        if (!filters.health.includes(healthStatus)) {
          return false
        }
      }

      if (filters.tags.length > 0) {
        const pipelineTags = (pipeline.metadata?.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        const requiredTags = filters.tags.map((tag) => tag.toLowerCase())
        const hasAllTags = requiredTags.every((tag) => pipelineTags.includes(tag))
        if (!hasAllTags) {
          return false
        }
      }

      return true
    })
  }, [pipelines, filters, pipelineStatuses])

  // Count pipelines that block new pipeline creation using effective status (active or paused)
  const activePipelinesCount = useMemo(() => {
    return pipelines.filter((p) => {
      const eff = pipelineStatuses[p.pipeline_id] ?? (p.status as PipelineStatus)
      return eff === 'active' || eff === 'paused' || eff === 'pausing' || eff === 'stopping'
    }).length
  }, [pipelines, pipelineStatuses])

  // Check if new pipeline creation should show limitation modal
  const shouldShowPipelineLimitModal = useMemo(() => {
    // Only show modal for local and docker platforms
    if (!isDocker && !isLocal) {
      return false
    }

    // Show modal if there are active or paused pipelines blocking new creation
    return activePipelinesCount > 0
  }, [isDocker, isLocal, activePipelinesCount])

  useEffect(() => {
    analytics.page.pipelines({})
  }, [])

  const columns = useMemo(
    () =>
      getPipelineListColumns({
        isPipelineLoading,
        getPipelineOperation,
        getEffectiveStatus,
        onStop: handleStop,
        onResume: handleResume,
        onEdit: handleEdit,
        onRename: handleRename,
        onTerminate: handleTerminate,
        onDelete: openDeleteConfirmModal,
        onDownload: handleDownload,
        onManageTags: handleManageTags,
      }),
    [
      isPipelineLoading,
      getPipelineOperation,
      getEffectiveStatus,
      handleStop,
      handleResume,
      handleEdit,
      handleRename,
      handleTerminate,
      openDeleteConfirmModal,
      handleDownload,
      handleManageTags,
    ],
  )

  const handleCreate = () => {
    // Check if we're on a platform with limitations and there are active pipelines
    if (shouldShowPipelineLimitModal) {
      setShowPipelineLimitModal(true)
      return
    }

    router.push('/home')
  }

  const handleTagsModalClose = () => {
    if (isSavingTags) return
    setIsTagsModalVisible(false)
    setTagsModalPipeline(null)
  }

  const handleTagsModalSave = async (newTags: string[]) => {
    if (!tagsModalPipeline) return

    const pipelineId = tagsModalPipeline.pipeline_id
    setIsSavingTags(true)
    setPipelineLoading(pipelineId, 'tags')

    try {
      await updatePipelineMetadata(pipelineId, { tags: newTags })
      onUpdatePipelineTags?.(pipelineId, newTags)
      setTagsModalPipeline((prev) => (prev ? { ...prev, metadata: { ...(prev.metadata || {}), tags: newTags } } : prev))
      notify({
        variant: 'success',
        title: 'Tags updated',
        description: `Tags saved for ${tagsModalPipeline.name}.`,
        channel: 'toast',
      })
      setIsTagsModalVisible(false)
      setTagsModalPipeline(null)
    } catch (error) {
      handleApiError(error, {
        operation: 'update tags',
        pipelineName: tagsModalPipeline.name,
      })
    } finally {
      clearPipelineLoading(pipelineId)
      setIsSavingTags(false)
    }
  }

  const handlePipelineLimitModalComplete = (result: string) => {
    setShowPipelineLimitModal(false)

    if (result === ModalResult.YES) {
      // Stay on pipelines page to manage active pipelines
      // The user can pause/delete the active pipeline from here
    }
  }

  // Filter handlers
  const handleClearStatusFilters = () => {
    setFilters({ ...filters, status: [] })
  }

  const handleClearHealthFilters = () => {
    setFilters({ ...filters, health: [] })
  }

  const handleClearTagFilters = () => {
    setFilters({ ...filters, tags: [] })
  }

  const getStatusLabels = () => {
    return filters.status.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  }

  const getHealthLabels = () => {
    return filters.health.map((h) => h.charAt(0).toUpperCase() + h.slice(1))
  }

  const getTagLabels = () => {
    return filters.tags
  }

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Header with title, filter button, chips, and new pipeline button */}
      <div className="flex items-center justify-between w-full flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-semibold">Pipelines</h1>
          <button
            ref={filterButtonRef}
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className="p-2 hover:opacity-70 rounded-lg transition-opacity duration-200 relative"
            aria-label="Filter pipelines"
          >
            <FilterIcon size={20} className="text-[var(--color-foreground-neutral-faded)]" />
            {(filters.status.length > 0 || filters.health.length > 0) && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))' }}
              />
            )}
          </button>

          {/* Filter chips - inline with title and button */}
          {filters.status.length > 0 && (
            <FilterChip
              label="Status"
              values={getStatusLabels()}
              onRemove={handleClearStatusFilters}
              onClick={() => setIsFilterMenuOpen(true)}
            />
          )}
          {filters.health.length > 0 && (
            <FilterChip
              label="Health"
              values={getHealthLabels()}
              onRemove={handleClearHealthFilters}
              onClick={() => setIsFilterMenuOpen(true)}
            />
          )}
          {filters.tags.length > 0 && (
            <FilterChip
              label="Tags"
              values={getTagLabels()}
              onRemove={handleClearTagFilters}
              onClick={() => setIsFilterMenuOpen(true)}
            />
          )}
        </div>

        <Button variant="primary" size="custom" onClick={handleCreate}>
          <CreateIcon className="action-icon" size={16} />
          New Pipeline
        </Button>
      </div>

      {/* Filter Menu */}
      <PipelineFilterMenu
        isOpen={isFilterMenuOpen}
        onClose={() => setIsFilterMenuOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        anchorEl={filterButtonRef.current}
        availableTags={availableTags}
      />

      {/* Desktop/Tablet Table */}
      <div className="hidden md:block">
        <PipelinesTable
          data={filteredPipelines}
          columns={columns}
          emptyMessage="No pipelines found. Adjust your filters or create a new pipeline to get started."
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden">
        <MobilePipelinesList
          pipelines={filteredPipelines}
          pipelineStatuses={pipelineStatuses}
          onStop={handleStop}
          onResume={handleResume}
          onEdit={handleEdit}
          onRename={handleRename}
          onTerminate={handleTerminate}
          onDelete={openDeleteConfirmModal}
          onManageTags={handleManageTags}
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
          isPipelineLoading={isPipelineLoading}
          getPipelineOperation={getPipelineOperation}
        />
      </div>

      <PipelineTagsModal
        visible={isTagsModalVisible}
        pipelineName={tagsModalPipeline?.name || ''}
        initialTags={tagsModalPipeline?.metadata?.tags || []}
        onSave={handleTagsModalSave}
        onCancel={handleTagsModalClose}
        isSaving={isSavingTags}
      />

      <StopPipelineModal
        visible={isStopModalVisible}
        onOk={async () => {
          if (!stopSelectedPipeline) return
          closeStopModal()
          await handleStopConfirm(stopSelectedPipeline)
        }}
        onCancel={closeStopModal}
      />
      <RenamePipelineModal
        visible={isRenameModalVisible}
        currentName={renameSelectedPipeline?.name || ''}
        onOk={async (newName) => {
          if (!renameSelectedPipeline || !newName) return
          closeRenameModal()
          await handleRenameConfirm(renameSelectedPipeline, newName)
        }}
        onCancel={closeRenameModal}
      />
      <EditPipelineModal
        visible={isEditModalVisible}
        onOk={async () => {
          if (!editSelectedPipeline) return
          closeEditModal()
          await handleEditConfirm(editSelectedPipeline)
        }}
        onCancel={closeEditModal}
      />
      <TerminatePipelineModal
        visible={isTerminateModalVisible}
        onOk={async () => {
          if (!deleteSelectedPipeline) return
          closeTerminateModal()
          await handleTerminateConfirm(deleteSelectedPipeline)
        }}
        onCancel={closeTerminateModal}
      />

      <DeletePipelineModal
        visible={isDeleteConfirmVisible}
        pipelineName={deleteConfirmPipeline?.name}
        onOk={handleDeleteConfirm}
        onCancel={closeDeleteConfirmModal}
      />

      <InfoModal
        visible={showPipelineLimitModal}
        title="Pipeline Limit Reached"
        description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active pipelines.`}
        okButtonText="Manage Pipelines"
        cancelButtonText="Cancel"
        onComplete={handlePipelineLimitModalComplete}
      />
    </div>
  )
}
