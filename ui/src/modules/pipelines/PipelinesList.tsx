'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { useStore } from '@/src/store'
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { ModalResult as InputModalResult } from '@/src/components/common/InputModal'
import { saveConfiguration } from '@/src/utils/local-storage-config'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { Pipeline, ListPipelineConfig, PipelineError } from '@/src/types/pipeline'
import { PipelinesTable, TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { TableContextMenu } from './TableContextMenu'
import { CreateIcon, FilterIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import StopPipelineModal from './components/StopPipelineModal'
import TerminatePipelineModal from './components/TerminatePipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import PipelineTagsModal from './components/PipelineTagsModal'
import { PipelineFilterMenu, FilterState } from './PipelineFilterMenu'
import { FilterChip } from './FilterChip'
import { useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal, useTerminatePipelineModal } from './hooks'
import { PipelineStatus } from '@/src/types/pipeline'
import { notify } from '@/src/notifications'
import { pipelineMessages } from '@/src/notifications/messages'
import { handleApiError } from '@/src/notifications/api-error-handler'
import {
  resumePipeline,
  renamePipeline,
  stopPipeline,
  terminatePipeline,
  deletePipeline,
  getPipeline,
  updatePipelineMetadata,
} from '@/src/api/pipeline-api'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { countPipelinesBlockingCreation } from '@/src/utils/pipeline-actions'
import { useMultiplePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineState'
import { downloadPipelineConfig } from '@/src/utils/pipeline-download'
import { formatNumber, formatCreatedAt } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'

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
  const { coreStore, resetAllPipelineState } = useStore()
  const { pipelineId, setPipelineId } = coreStore
  const [status, setStatus] = useState<PipelineStatus>('active')
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
  const { isFeatureDisabled, isDocker, isLocal } = usePlatformDetection()
  const [isMobile, setIsMobile] = useState(false)
  const [showPipelineLimitModal, setShowPipelineLimitModal] = useState(false)

  // Filter state
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [filters, setFilters] = useState<FilterState>(() => parseFiltersFromParams(searchParams))
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterButtonRef = React.useRef<HTMLButtonElement>(null)

  const [tagsModalPipeline, setTagsModalPipeline] = useState<ListPipelineConfig | null>(null)
  const [isTagsModalVisible, setIsTagsModalVisible] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)

  // Track loading operations for individual pipelines
  const [pipelineOperations, setPipelineOperations] = useState<
    Record<
      string,
      {
        isLoading: boolean
        operation: 'stop' | 'resume' | 'terminate' | 'delete' | 'rename' | 'edit' | 'tags' | null
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

  // Helper functions to manage pipeline operation state
  const setPipelineLoading = (
    pipelineId: string,
    operation: 'stop' | 'resume' | 'terminate' | 'delete' | 'rename' | 'edit' | 'tags',
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

  useEffect(() => {
    const parsed = parseFiltersFromParams(searchParams)
    setFilters((current) => (areFiltersEqual(current, parsed) ? current : parsed))
  }, [searchParams])

  useEffect(() => {
    const serialized = serializeFilters(filters)
    if (serialized === searchParams.toString()) {
      return
    }

    const nextUrl = serialized ? `${pathname}?${serialized}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [filters, pathname, router, searchParams])

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
        resetAllPipelineState('', true)

        // Track successful pipeline modification
        analytics.pipeline.modifySuccess({})

        router.push('/home')
      } catch (err) {
        const error = err as PipelineError
        setStatus('failed')

        // Show notification to user using centralized error handler
        handleApiError(err, {
          operation: 'fetch',
          retryFn: () => onRefresh?.(),
        })

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
      case 'terminating':
        return 'Terminating...'
      case 'terminated':
        return 'Terminated'
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
      case 'terminating':
        return 'warning'
      case 'terminated':
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
      sortable: true,
      render: (pipeline) => {
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        const operation = getPipelineOperation(pipeline.pipeline_id)

        return (
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-1">
                <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
                {/* <span className="text-xs text-blue-600">
                  {operation === 'stop' && 'Stopping...'}
                  {operation === 'resume' && 'Resuming...'}
                  {operation === 'delete' && 'Deleting...'}
                  {operation === 'rename' && 'Renaming...'}
                  {operation === 'edit' && 'Stopping...'}
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
      sortable: true,
      sortKey: 'transformation_type',
      render: (pipeline) => pipeline.transformation_type || 'None',
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      align: 'left',
      render: (pipeline) => <TagsCell tags={pipeline.metadata?.tags || []} />,
    },
    {
      key: 'health',
      header: 'Health',
      width: '1fr',
      align: 'left',
      sortable: true,
      sortKey: 'health_status',
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
      sortable: true,
      sortKey: 'dlq_stats.unconsumed_messages',
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
      sortable: true,
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
      key: 'created_at',
      header: 'Created',
      width: '1.5fr',
      align: 'left',
      sortable: true,
      render: (pipeline) => {
        return (
          <div className="flex flex-row items-center justify-start text-content">
            {formatCreatedAt(pipeline.created_at)}
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
            onStop={() => handleStop(pipeline)}
            onResume={() => handleResume(pipeline)}
            onEdit={() => handleEdit(pipeline)}
            onRename={() => handleRename(pipeline)}
            onTerminate={() => handleTerminate(pipeline)}
            onDelete={() => handleDelete(pipeline)}
            onDownload={() => handleDownload(pipeline)}
            onManageTags={() => handleManageTags(pipeline)}
          />
        )
      },
    },
  ]

  // Context menu handlers
  const handleStop = (pipeline: ListPipelineConfig) => {
    openStopModal(pipeline)
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

      // CRITICAL: Clear the hydration cache so the pipeline re-hydrates with fresh data
      // This ensures that if the pipeline was edited while stopped, the changes are reflected
      sessionStorage.removeItem('lastHydratedPipeline')

      // Track resume success
      analytics.pipeline.resumeSuccess({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
      })

      // Central system handles tracking and state updates
    } catch (error) {
      // Show notification to user using centralized error handler
      handleApiError(error, {
        operation: 'resume',
        pipelineName: pipeline.name,
      })

      // Track resume failure
      analytics.pipeline.resumeFailed({
        pipelineId: pipeline.pipeline_id,
        pipelineName: pipeline.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Revert optimistic update
      operations.revertOptimisticUpdate(pipeline.pipeline_id, 'stopped')
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

  const handleTerminate = (pipeline: ListPipelineConfig) => {
    openTerminateModal(pipeline)
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
      // Show notification to user using centralized error handler
      handleApiError(error, {
        operation: 'delete',
        pipelineName: pipeline.name,
        retryFn: () => handleDelete(pipeline),
      })

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
      notify({
        variant: 'error',
        title: 'Failed to download pipeline configuration.',
        description: 'The configuration file could not be downloaded.',
        action: { label: 'Try again', onClick: () => handleDownload(pipeline) },
        reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
        channel: 'toast',
      })
    }
  }

  const handleManageTags = (pipeline: ListPipelineConfig) => {
    setTagsModalPipeline(pipeline)
    setIsTagsModalVisible(true)
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
            <FilterIcon size={20} className="text-gray-600" />
            {(filters.status.length > 0 || filters.health.length > 0) && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'linear-gradient(134deg, #ffa959 18.07%, #e7872e 76.51%)' }}
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

        <Button variant="default" className="btn-primary btn-text" onClick={handleCreate}>
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
          healthMap={pipelineStatuses} // NEW: Use centralized statuses
          onStop={handleStop}
          onResume={handleResume}
          onEdit={handleEdit}
          onRename={handleRename}
          onTerminate={handleTerminate}
          onDelete={handleDelete}
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

          // Track stop clicked
          analytics.pipeline.pauseClicked({
            pipelineId: stopSelectedPipeline.pipeline_id,
            pipelineName: stopSelectedPipeline.name,
            currentStatus: stopSelectedPipeline.status,
          })

          closeStopModal() // Close modal immediately
          setPipelineLoading(stopSelectedPipeline.pipeline_id, 'stop')

          try {
            // Report operation to central system
            operations.reportStop(stopSelectedPipeline.pipeline_id)

            // Make API call - stop is graceful
            await stopPipeline(stopSelectedPipeline.pipeline_id)

            // Track stop success
            analytics.pipeline.pauseSuccess({
              pipelineId: stopSelectedPipeline.pipeline_id,
              pipelineName: stopSelectedPipeline.name,
            })

            // Central system handles tracking and state updates
          } catch (error) {
            // Show notification to user using centralized error handler
            handleApiError(error, {
              operation: 'stop',
              pipelineName: stopSelectedPipeline.name,
              retryFn: async () => {
                // Retry stop operation
                try {
                  setPipelineLoading(stopSelectedPipeline.pipeline_id, 'stop')
                  operations.reportStop(stopSelectedPipeline.pipeline_id)
                  await stopPipeline(stopSelectedPipeline.pipeline_id)
                  analytics.pipeline.pauseSuccess({
                    pipelineId: stopSelectedPipeline.pipeline_id,
                    pipelineName: stopSelectedPipeline.name,
                  })
                } catch (retryError) {
                  handleApiError(retryError, {
                    operation: 'stop',
                    pipelineName: stopSelectedPipeline.name,
                  })
                } finally {
                  clearPipelineLoading(stopSelectedPipeline.pipeline_id)
                }
              },
            })

            // Track stop failure
            analytics.pipeline.pauseFailed({
              pipelineId: stopSelectedPipeline.pipeline_id,
              pipelineName: stopSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            })

            // Revert optimistic update
            operations.revertOptimisticUpdate(stopSelectedPipeline.pipeline_id, 'active')
          } finally {
            clearPipelineLoading(stopSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closeStopModal()
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
            // Show notification to user using centralized error handler
            handleApiError(error, {
              operation: 'rename',
              pipelineName: renameSelectedPipeline.name,
              retryFn: () => openRenameModal(renameSelectedPipeline),
            })

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
            // Check if pipeline is active and needs to be stopped first
            if (editSelectedPipeline.status === 'active') {
              // Optimistically update status to 'stopping'
              onUpdatePipelineStatus?.(editSelectedPipeline.pipeline_id, 'stopping')

              // Stop the pipeline first
              await stopPipeline(editSelectedPipeline.pipeline_id)

              // Update status to final 'stopped' state after successful stop for edit
              onUpdatePipelineStatus?.(editSelectedPipeline.pipeline_id, 'stopped')

              // Skip refresh since we're navigating to edit page immediately
            }

            // Track edit success (preparation completed)
            analytics.pipeline.editSuccess({
              pipelineId: editSelectedPipeline.pipeline_id,
              pipelineName: editSelectedPipeline.name,
              wasPausedForEdit: editSelectedPipeline.status === 'active', // Keep analytics name for backward compatibility
            })

            // Navigate to pipeline details page for editing
            router.push(`/pipelines/${editSelectedPipeline.pipeline_id}`)
          } catch (error) {
            // Use centralized error handler - it will handle "must be stopped" errors
            handleApiError(error, {
              operation: 'edit',
              pipelineName: editSelectedPipeline.name,
              retryFn: () => handleEdit(editSelectedPipeline),
              onMustBeStopped: () => handleStop(editSelectedPipeline), // Special handler for "must be stopped"
            })

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
      <TerminatePipelineModal
        visible={isTerminateModalVisible}
        onOk={async () => {
          if (!deleteSelectedPipeline) return

          // Track terminate clicked
          analytics.pipeline.deleteClicked({
            pipelineId: deleteSelectedPipeline.pipeline_id,
            pipelineName: deleteSelectedPipeline.name,
            currentStatus: deleteSelectedPipeline.status,
            processEvents: false, // Terminate is always ungraceful
          })

          closeTerminateModal() // Close modal immediately
          setPipelineLoading(deleteSelectedPipeline.pipeline_id, 'delete')

          try {
            // Report operation to central system
            operations.reportTerminate(deleteSelectedPipeline.pipeline_id)

            // Make API call - terminate is always ungraceful
            await terminatePipeline(deleteSelectedPipeline.pipeline_id)

            // Track terminate success
            analytics.pipeline.deleteSuccess({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              processEvents: false,
            })

            // Central system handles tracking and state updates
          } catch (error) {
            // Show notification to user using centralized error handler
            handleApiError(error, {
              operation: 'terminate',
              pipelineName: deleteSelectedPipeline.name,
            })

            // Track terminate failure
            analytics.pipeline.deleteFailed({
              pipelineId: deleteSelectedPipeline.pipeline_id,
              pipelineName: deleteSelectedPipeline.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              processEvents: false,
            })

            // Revert optimistic update
            const currentStatus = (deleteSelectedPipeline.status as PipelineStatus) || 'active'
            operations.revertOptimisticUpdate(deleteSelectedPipeline.pipeline_id, currentStatus)
          } finally {
            clearPipelineLoading(deleteSelectedPipeline.pipeline_id)
          }
        }}
        onCancel={() => {
          closeTerminateModal()
        }}
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

const TagsCell = ({ tags }: { tags: string[] }) => {
  if (!tags || tags.length === 0) {
    return <span className="text-sm text-muted-foreground">No tags</span>
  }

  const visibleTags = tags.slice(0, 3)
  const remaining = tags.length - visibleTags.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-full px-2 py-0.5 text-xs font-medium">
          {tag}
        </Badge>
      ))}
      {remaining > 0 && <span className="text-xs text-muted-foreground">+{remaining} more</span>}
    </div>
  )
}

const ActiveChip = ({ status }: { status: Pipeline['status'] }) => {
  return <span className="chip-positive">{status}</span>
}

const STATUS_FILTER_SET = new Set<PipelineStatus>(['active', 'paused', 'stopped', 'failed'])
const HEALTH_FILTER_SET = new Set<'stable' | 'unstable'>(['stable', 'unstable'])

function parseCommaSeparatedValues(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => decodeURIComponent(item.trim()))
    .filter(Boolean)
}

function parseFiltersFromParams(params: ReadonlyURLSearchParams | URLSearchParams): FilterState {
  const rawStatus = parseCommaSeparatedValues(params.get('status'))
  const status = rawStatus.reduce<PipelineStatus[]>((acc, value) => {
    const normalized = value.toLowerCase() as PipelineStatus
    if (STATUS_FILTER_SET.has(normalized)) {
      acc.push(normalized)
    }
    return acc
  }, [])

  const rawHealth = parseCommaSeparatedValues(params.get('health'))
  const health = rawHealth.reduce<Array<'stable' | 'unstable'>>((acc, value) => {
    const normalized = value.toLowerCase() as 'stable' | 'unstable'
    if (HEALTH_FILTER_SET.has(normalized)) {
      acc.push(normalized)
    }
    return acc
  }, [])

  const tags = parseCommaSeparatedValues(params.get('tags'))

  return { status, health, tags }
}

function areFiltersEqual(a: FilterState, b: FilterState) {
  if (a.status.length !== b.status.length || a.health.length !== b.health.length || a.tags.length !== b.tags.length) {
    return false
  }

  const compareArrays = (first: string[], second: string[]) => {
    return first.every((value, index) => second[index] === value)
  }

  return compareArrays(a.status, b.status) && compareArrays(a.health, b.health) && compareArrays(a.tags, b.tags)
}

function serializeFilters(filters: FilterState) {
  const params = new URLSearchParams()
  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','))
  }
  if (filters.health.length > 0) {
    params.set('health', filters.health.join(','))
  }
  if (filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','))
  }
  return params.toString()
}
