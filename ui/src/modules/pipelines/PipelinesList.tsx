'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { PageShell } from '@/src/components/shared/page-shell'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { PipelinesTable } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { CreateIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import StopPipelineModal from './components/StopPipelineModal'
import TerminatePipelineModal from './components/TerminatePipelineModal'
import DeletePipelineModal from './components/DeletePipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import PipelineTagsModal from './components/PipelineTagsModal'
import { PipelineFilterMenu } from './PipelineFilterMenu'
import { useFiltersFromUrl } from './utils/filterUrl'
import { useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal, useTerminatePipelineModal } from './hooks'
import { PipelineStatus } from '@/src/types/pipeline'
import { notify } from '@/src/notifications'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { updatePipelineMetadata } from '@/src/api/pipeline-api'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import {
  useMultiplePipelineState,
  usePipelineOperations,
  usePipelineMonitoring,
} from '@/src/hooks/usePipelineStateAdapter'
import { getPipelineListColumns } from './columns/pipelineListColumns'
import { enrichPipeline } from './utils/enrichPipelineStubs'
import { usePipelineListOperations } from './usePipelineListOperations'
import { DownloadFormatModal, type DownloadFormat } from '@/src/components/common/DownloadFormatModal'
import { useBulkSelection } from './hooks/useBulkSelection'
import { useListSearch } from './hooks/useListSearch'
import { useSavedViews } from './hooks/useSavedViews'
import { PipelinesToolbar } from './components/PipelinesToolbar'
import { SavedViewsStrip } from './components/SavedViewsStrip'
import { BulkActionBar } from './components/BulkActionBar'
import { BulkTagModal } from './components/BulkTagModal'

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

  const [densityMode, setDensityMode] = useState<'table' | 'hybrid' | 'cards'>('table')
  const search = useListSearch()
  const bulk = useBulkSelection()
  const savedViews = useSavedViews({ onFiltersChange: setFilters, initialFilters: filters })

  const [isBulkTagModalVisible, setIsBulkTagModalVisible] = useState(false)
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  const [tagsModalPipeline, setTagsModalPipeline] = useState<ListPipelineConfig | null>(null)
  const [isTagsModalVisible, setIsTagsModalVisible] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [deleteConfirmPipeline, setDeleteConfirmPipeline] = useState<ListPipelineConfig | null>(null)
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false)
  const [downloadModalPipeline, setDownloadModalPipeline] = useState<ListPipelineConfig | null>(null)

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

  const handleOpenDownloadModal = useCallback((pipeline: ListPipelineConfig) => {
    setDownloadModalPipeline(pipeline)
  }, [])

  const handleDownloadWithFormat = useCallback(
    async (format: DownloadFormat) => {
      if (!downloadModalPipeline) return
      setDownloadModalPipeline(null)
      await handleDownload(downloadModalPipeline, format)
    },
    [downloadModalPipeline, handleDownload],
  )

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

  const filteredPipelines = useMemo(() => {
    const statusHealthTagFiltered = pipelines.filter((pipeline) => {
      if (filters.status.length > 0) {
        const effectiveStatus = getEffectiveStatus(pipeline)
        if (!filters.status.includes(effectiveStatus)) {
          return false
        }
      }

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
    return search.filterBySearch(statusHealthTagFiltered)
  }, [pipelines, filters, pipelineStatuses, search.filterBySearch])

  const activePipelinesCount = useMemo(() => {
    return pipelines.filter((p) => {
      const eff = pipelineStatuses[p.pipeline_id] ?? (p.status as PipelineStatus)
      return eff === 'active' || eff === 'paused' || eff === 'pausing' || eff === 'stopping'
    }).length
  }, [pipelines, pipelineStatuses])

  const shouldShowPipelineLimitModal = useMemo(() => {
    if (!isDocker && !isLocal) {
      return false
    }
    return activePipelinesCount > 0
  }, [isDocker, isLocal, activePipelinesCount])

  useEffect(() => {
    analytics.page.pipelines({})
  }, [analytics])

  useEffect(() => {
    bulk.clearSelection()
  }, [filters])

  const handleBulkStop = useCallback(async () => {
    setIsBulkLoading(true)
    try {
      for (const id of bulk.selectedIds) {
        const pipeline = pipelines.find((p) => p.pipeline_id === id)
        if (pipeline) await handleStop(pipeline)
      }
    } finally {
      bulk.clearSelection()
      setIsBulkLoading(false)
    }
  }, [bulk.selectedIds, pipelines, handleStop])

  const handleBulkResume = useCallback(async () => {
    setIsBulkLoading(true)
    try {
      for (const id of bulk.selectedIds) {
        const pipeline = pipelines.find((p) => p.pipeline_id === id)
        if (pipeline) await handleResume(pipeline)
      }
    } finally {
      bulk.clearSelection()
      setIsBulkLoading(false)
    }
  }, [bulk.selectedIds, pipelines, handleResume])

  const handleBulkTerminate = useCallback(async () => {
    setIsBulkLoading(true)
    try {
      for (const id of bulk.selectedIds) {
        const pipeline = pipelines.find((p) => p.pipeline_id === id)
        if (pipeline) await handleTerminate(pipeline)
      }
    } finally {
      bulk.clearSelection()
      setIsBulkLoading(false)
    }
  }, [bulk.selectedIds, pipelines, handleTerminate])

  const handleBulkDelete = useCallback(async () => {
    setIsBulkLoading(true)
    try {
      for (const id of bulk.selectedIds) {
        const pipeline = pipelines.find((p) => p.pipeline_id === id)
        if (pipeline) await handleDelete(pipeline)
      }
    } finally {
      bulk.clearSelection()
      setIsBulkLoading(false)
    }
  }, [bulk.selectedIds, pipelines, handleDelete])

  const handleBulkAddTagsConfirm = useCallback(
    async (tags: string[]) => {
      if (!tags.length) return
      setIsBulkLoading(true)
      try {
        for (const id of bulk.selectedIds) {
          const pipeline = pipelines.find((p) => p.pipeline_id === id)
          if (!pipeline) continue
          const existingTags = pipeline.metadata?.tags || []
          const merged = Array.from(new Set([...existingTags, ...tags]))
          await updatePipelineMetadata(id, { tags: merged })
          onUpdatePipelineTags?.(id, merged)
        }
        notify({
          variant: 'success',
          title: 'Tags added',
          description: `Tags added to ${bulk.selectedCount} pipelines.`,
          channel: 'toast',
        })
      } catch (error) {
        handleApiError(error, { operation: 'add tags' })
      } finally {
        setIsBulkTagModalVisible(false)
        bulk.clearSelection()
        setIsBulkLoading(false)
      }
    },
    [bulk.selectedIds, bulk.selectedCount, pipelines, onUpdatePipelineTags],
  )

  const getRowClassName = useCallback((_pipeline: ListPipelineConfig): string => '', [])

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
        onDownload: handleOpenDownloadModal,
        onManageTags: handleManageTags,
        onToggleSelect: bulk.toggleRow,
        isSelected: bulk.isSelected,
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
      handleOpenDownloadModal,
      handleManageTags,
      bulk.toggleRow,
      bulk.isSelected,
    ],
  )

  const handleCreate = () => {
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
    }
  }

  const pipelineStats = useMemo(() => {
    const envs = new Set(pipelines.map((p) => enrichPipeline(p, getEffectiveStatus(p)).env))
    const teams = new Set(pipelines.map((p) => enrichPipeline(p, getEffectiveStatus(p)).owner.team))
    return { total: pipelines.length, envCount: envs.size, teamCount: teams.size }
  }, [pipelines, getEffectiveStatus])

  const subtitle =
    pipelineStats.total > 0
      ? `${pipelineStats.total} pipelines${
          pipelineStats.envCount > 0
            ? ` · ${pipelineStats.envCount} environment${pipelineStats.envCount !== 1 ? 's' : ''}`
            : ''
        }${
          pipelineStats.teamCount > 0
            ? ` · ${pipelineStats.teamCount} team${pipelineStats.teamCount !== 1 ? 's' : ''}`
            : ''
        }`
      : undefined

  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={handleCreate}>
        Import
      </Button>
      <Button variant="primary" size="custom" onClick={handleCreate}>
        <CreateIcon className="action-icon" size={16} />
        Create pipeline
      </Button>
    </>
  )

  return (
    <PageShell title="Pipelines" subtitle={subtitle} crumbs={[{ label: 'Pipelines' }]} actions={actions}>
      <div className="flex flex-col w-full gap-4">
        {/* Saved views tab strip */}
        <SavedViewsStrip
          views={savedViews.views}
          activeViewId={savedViews.activeViewId}
          onSelectView={savedViews.selectView}
          onSaveCurrentView={(name) => savedViews.saveCurrentView(name, filters)}
          onDeleteView={savedViews.deleteView}
          getPipelineCount={(view) => {
            if (view.id === savedViews.activeViewId) return filteredPipelines.length
            return pipelines.filter((p) => {
              if (view.filters.status.length > 0 && !view.filters.status.includes(getEffectiveStatus(p))) return false
              if (view.filters.health.length > 0 && !view.filters.health.includes(p.health_status || 'stable'))
                return false
              return true
            }).length
          }}
        />

        {/* Toolbar: search, filter button, chips, density toggle */}
        <PipelinesToolbar
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          availableTags={availableTags}
          densityMode={densityMode}
          onDensityChange={setDensityMode}
          filterButtonRef={filterButtonRef}
          isFilterMenuOpen={isFilterMenuOpen}
          onFilterMenuToggle={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
        />

        {/* Filter Menu */}
        <PipelineFilterMenu
          isOpen={isFilterMenuOpen}
          onClose={() => setIsFilterMenuOpen(false)}
          filters={filters}
          onFiltersChange={setFilters}
          anchorEl={filterButtonRef.current}
          availableTags={availableTags}
        />

        {/* Bulk action bar */}
        {bulk.selectedCount > 0 && (
          <BulkActionBar
            selectedCount={bulk.selectedCount}
            totalVisible={filteredPipelines.length}
            onStop={handleBulkStop}
            onResume={handleBulkResume}
            onTerminate={handleBulkTerminate}
            onDelete={handleBulkDelete}
            onAddTag={() => setIsBulkTagModalVisible(true)}
            isLoading={isBulkLoading}
          />
        )}

        {/* Desktop/Tablet Table */}
        <div className="hidden md:block">
          <PipelinesTable
            data={filteredPipelines}
            columns={columns}
            rowClassName={getRowClassName}
            emptyMessage="No pipelines found. Adjust your filters or create a new pipeline to get started."
            onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
            className="pipelines-table"
            stickyHeader
            initialSortColumn="status"
            initialSortDirection="asc"
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
      <DownloadFormatModal
        visible={!!downloadModalPipeline}
        onDownload={handleDownloadWithFormat}
        onCancel={() => setDownloadModalPipeline(null)}
      />
      <BulkTagModal
        visible={isBulkTagModalVisible}
        selectedCount={bulk.selectedCount}
        onAddTags={handleBulkAddTagsConfirm}
        onCancel={() => setIsBulkTagModalVisible(false)}
        isLoading={isBulkLoading}
      />
      <InfoModal
        visible={showPipelineLimitModal}
        title="Pipeline Limit Reached"
        description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active pipelines.`}
        okButtonText="Manage Pipelines"
        cancelButtonText="Cancel"
        onComplete={handlePipelineLimitModalComplete}
      />
    </PageShell>
  )
}
