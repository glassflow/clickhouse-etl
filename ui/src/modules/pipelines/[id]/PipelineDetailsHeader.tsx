'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { Copy, Check, Tag as TagIcon } from 'lucide-react'
import TerminatePipelineModal from '@/src/modules/pipelines/components/TerminatePipelineModal'
import RenamePipelineModal from '@/src/modules/pipelines/components/RenamePipelineModal'
import StopPipelineModal from '@/src/modules/pipelines/components/StopPipelineModal'
import UnsavedChangesDownloadModal from '@/src/modules/pipelines/components/UnsavedChangesDownloadModal'
import FlushDLQModal from '@/src/modules/pipelines/components/FlushDLQModal'
import { Pipeline } from '@/src/types/pipeline'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { PipelineAction } from '@/src/types/pipeline'
import { usePipelineHealth } from '@/src/hooks/usePipelineHealth'
import { useStore } from '@/src/store'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import PlayIcon from '@/src/images/play.svg'
import EditIcon from '@/src/images/edit.svg'
import RenameIcon from '@/src/images/rename.svg'
import DeleteIcon from '@/src/images/trash.svg'
import CloseIcon from '@/src/images/close.svg'
import DownloadIcon from '@/src/images/download-white.svg'
import StopWhiteIcon from '@/src/images/stop-white.svg'
import MenuWhiteIcon from '@/src/images/menu-white.svg'
import { PipelineStatus, parsePipelineStatus } from '@/src/types/pipeline'
import { usePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineState'
import { downloadPipelineConfig } from '@/src/utils/pipeline-download'
import { isDemoMode, getRuntimeEnv } from '@/src/utils/common.client'
import { cn } from '@/src/utils/common.client'
import { purgePipelineDLQ } from '@/src/api/pipeline-api'
import { notify } from '@/src/notifications'
import { pipelineMessages, metricsMessages, dlqMessages } from '@/src/notifications/messages'

interface PipelineDetailsHeaderProps {
  pipeline: Pipeline
  onPipelineUpdate?: (updatedPipeline: Pipeline) => void
  onPipelineDeleted?: () => void
  actions?: React.ReactNode
  showHeader?: boolean
  onManageTags?: () => void
  tags?: string[]
}

function PipelineDetailsHeader({
  pipeline,
  onPipelineUpdate,
  onPipelineDeleted,
  actions,
  showHeader = true,
  onManageTags,
  tags,
}: PipelineDetailsHeaderProps) {
  const [activeModal, setActiveModal] = useState<PipelineAction | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDownloadWarningModal, setShowDownloadWarningModal] = useState(false)
  const [showFlushDLQModal, setShowFlushDLQModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const recentActionRef = useRef<{ action: PipelineAction; timestamp: number } | null>(null)

  // Get store to check for unsaved changes
  const { coreStore } = useStore()

  // Get centralized pipeline status and operations
  const centralizedStatus = usePipelineState(pipeline.pipeline_id)
  const operations = usePipelineOperations()

  // Start monitoring this pipeline for status updates from other tabs
  usePipelineMonitoring([pipeline.pipeline_id])

  // Use centralized status if available, otherwise fall back to pipeline prop
  const effectiveStatus = centralizedStatus || (pipeline.status as PipelineStatus) || 'active'

  // Disable health monitoring during transitional states to avoid conflicts with centralized tracking
  const isInTransitionalState =
    effectiveStatus === 'pausing' || effectiveStatus === 'stopping' || effectiveStatus === 'resuming'

  // Use simplified pipeline health monitoring
  const {
    health,
    isLoading: healthLoading,
    error: healthError,
  } = usePipelineHealth({
    pipelineId: pipeline.pipeline_id,
    enabled: !isInTransitionalState, // Disable during transitional states
    pollingInterval: 5000, // 5 seconds - conservative interval
    stopOnStatuses: ['Running', 'Terminated', 'Failed'], // Stop on stable states
    maxRetries: 2,
    onStatusChange: (newStatus, previousStatus) => {
      // console.log(`Pipeline ${pipeline.pipeline_id} health status changed: ${previousStatus} → ${newStatus}`)
    },
    onError: (error) => {
      console.error(`Pipeline ${pipeline.pipeline_id} health check error:`, error)
    },
  })

  // Create a pipeline object with effective status for action configuration
  const pipelineWithEffectiveStatus = {
    ...pipeline,
    status: effectiveStatus as Pipeline['status'],
  }

  const tagsList = tags ?? pipeline.metadata?.tags ?? []

  // Demo mode is checked once and passed to hook for centralized handling
  const demoMode = isDemoMode()

  const {
    actionState,
    executeAction,
    getActionConfiguration,
    getButtonText,
    isActionDisabled,
    shouldShowAction,
    shouldShowModal,
    clearError,
    getAvailableActionsForPipeline,
  } = usePipelineActions(pipelineWithEffectiveStatus, { demoMode })

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
        // Track if we performed an edit before resume
        let didEditBeforeResume = false

        // NEW: Report operations to centralized system for status tracking
        if (action === 'stop') {
          operations.reportStop(pipeline.pipeline_id)
        } else if (action === 'resume') {
          // Check if there are unsaved changes before resuming
          const { coreStore } = useStore.getState()
          if (coreStore.isDirty) {
            // Generate and send updated configuration before resuming
            const { generateApiConfig } = await import('@/src/modules/clickhouse/utils')
            const {
              kafkaStore,
              topicsStore,
              clickhouseConnectionStore,
              clickhouseDestinationStore,
              joinStore,
              deduplicationStore,
            } = useStore.getState()
            // Log all deduplication configs
            // const topicIndices = Object.keys(topicsStore.topics || {})

            const apiConfig = generateApiConfig({
              pipelineId: coreStore.pipelineId,
              pipelineName: coreStore.pipelineName,
              setPipelineId: coreStore.setPipelineId,
              clickhouseConnection: clickhouseConnectionStore.clickhouseConnection,
              clickhouseDestination: clickhouseDestinationStore.clickhouseDestination,
              selectedTopics: Object.values(topicsStore.topics || {}),
              getMappingType: (eventField: string, mapping: any) => {
                const mappingEntry = mapping.find((m: any) => m.eventField === eventField)
                if (mappingEntry) {
                  return mappingEntry.jsonType
                }
                return 'string'
              },
              joinStore,
              kafkaStore,
              deduplicationStore,
              version: coreStore.pipelineVersion, // Respect the original pipeline version
            })

            // Send edit request to backend (backend will automatically resume after edit)
            const editResult = await executeAction('edit', apiConfig)

            // Mark as clean after successful edit
            coreStore.markAsClean()

            // Set flag to indicate we edited before resume
            didEditBeforeResume = true
          }

          // CRITICAL: For resume action, report optimistic update BEFORE executing
          // This ensures UI updates immediately
          operations.reportResume(pipeline.pipeline_id)
        } else if (action === 'terminate') {
          operations.reportTerminate(pipeline.pipeline_id)
        } else if (action === 'delete') {
          operations.reportDelete(pipeline.pipeline_id)
          // Handle navigation in the parent component
          onPipelineDeleted?.()
        }

        // Execute the action and wait for result
        // IMPORTANT: Skip resume action if we already did edit (backend auto-resumes after edit)
        const result = !didEditBeforeResume ? await executeAction(action) : undefined

        // CRITICAL: If we just edited and resumed, we need to:
        // 1. Fetch the fresh pipeline config from backend
        // 2. Reset stores to clear old data
        // 3. Update pipeline prop to trigger re-hydration
        if (action === 'resume' && didEditBeforeResume) {
          // Fetch the updated pipeline configuration from the backend
          const { getPipeline } = await import('@/src/api/pipeline-api')
          const updatedPipeline = await getPipeline(pipeline.pipeline_id)

          // Clear the hydration cache so the pipeline re-hydrates with fresh data
          sessionStorage.removeItem('lastHydratedPipeline')

          // Reset all relevant stores to force complete re-hydration

          const {
            topicsStore: currentTopicsStore,
            deduplicationStore: currentDeduplicationStore,
            joinStore: currentJoinStore,
            coreStore: currentCoreStore,
          } = useStore.getState()

          // Reset all stores that depend on pipeline configuration
          currentTopicsStore.resetTopicsStore()
          currentDeduplicationStore.resetDeduplicationStore()
          currentJoinStore.resetJoinStore()

          // CRITICAL: Reset mode to 'view' to allow re-hydration on next edit
          // Without this, the mode stays 'edit' and blocks hydration in PipelineDetailsModule
          currentCoreStore.setMode('view')

          // Update the local pipeline state with the fresh configuration
          // This will trigger re-hydration in PipelineDetailsModule
          if (onPipelineUpdate) {
            onPipelineUpdate(updatedPipeline)
          }
        } else {
          // For all other cases (normal resume, stop, terminate, delete), just update normally
          if (result && onPipelineUpdate) {
            onPipelineUpdate(result as Pipeline)
          }
        }

        // Mark recent action for health monitoring coordination
        recentActionRef.current = { action, timestamp: Date.now() }
      } catch (error) {
        // NEW: Revert optimistic updates using centralized system
        if (action === 'stop') {
          operations.revertOptimisticUpdate(pipeline.pipeline_id, 'active')
        } else if (action === 'resume') {
          operations.revertOptimisticUpdate(pipeline.pipeline_id, 'stopped')
        } else if (action === 'terminate') {
          const currentStatus = (pipeline.status as PipelineStatus) || 'active'
          operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
        } else if (action === 'delete') {
          const currentStatus = (pipeline.status as PipelineStatus) || 'active'
          operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
        }
      }
    }
  }

  const handleDownloadClick = async () => {
    // Check for unsaved changes
    if (coreStore.isDirty) {
      // Show warning modal if there are unsaved changes
      setShowDownloadWarningModal(true)
      return
    }

    // No unsaved changes, proceed with download
    await proceedWithDownload()
  }

  const handleFlushDataClick = () => {
    // Show confirmation modal first
    setShowFlushDLQModal(true)
  }

  const handleFlushDLQConfirm = async () => {
    setShowFlushDLQModal(false)
    try {
      await purgePipelineDLQ(pipeline.pipeline_id)
      // Show success notification
      notify(dlqMessages.purgeSuccess())
    } catch (error) {
      // Show error notification
      notify(dlqMessages.purgeFailed(handleFlushDataClick))
    }
  }

  const handleFlushDLQCancel = () => {
    setShowFlushDLQModal(false)
  }

  // Helper function to check if Grafana dashboard is available
  const isDashboardAvailable = (): boolean => {
    const isServer = typeof window === 'undefined'

    if (isServer) {
      return !!(process.env.NEXT_PUBLIC_DASHBOARD && isDemoMode())
    } else {
      const runtimeEnv = getRuntimeEnv() as any
      const dashboardUrl = runtimeEnv.NEXT_PUBLIC_DASHBOARD || process.env.NEXT_PUBLIC_DASHBOARD
      return !!(dashboardUrl && isDemoMode())
    }
  }

  // Helper function to get dashboard URL
  const getDashboardUrl = (): string | null => {
    const isServer = typeof window === 'undefined'

    if (isServer) {
      return process.env.NEXT_PUBLIC_DASHBOARD || null
    } else {
      const runtimeEnv = getRuntimeEnv() as any
      return runtimeEnv.NEXT_PUBLIC_DASHBOARD || process.env.NEXT_PUBLIC_DASHBOARD || null
    }
  }

  const handleGrafanaClick = () => {
    const dashboardUrl = getDashboardUrl()
    if (dashboardUrl) {
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const proceedWithDownload = async () => {
    try {
      await downloadPipelineConfig(pipeline)
      setShowDownloadWarningModal(false) // Close modal if it was open
    } catch (error) {
      notify({
        variant: 'error',
        title: 'Failed to download pipeline configuration.',
        description: 'The configuration file could not be downloaded.',
        action: { label: 'Try again', onClick: proceedWithDownload },
        reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
        channel: 'toast',
      })
    }
  }

  const handleDownloadWarningCancel = () => {
    setShowDownloadWarningModal(false)
  }

  const handleModalConfirm = async (action: PipelineAction, payload?: any) => {
    try {
      // NEW: Report operations to centralized system for status tracking
      if (action === 'stop') {
        operations.reportStop(pipeline.pipeline_id)
      } else if (action === 'resume') {
        operations.reportResume(pipeline.pipeline_id)
      } else if (action === 'terminate') {
        operations.reportTerminate(pipeline.pipeline_id)
      } else if (action === 'delete') {
        operations.reportDelete(pipeline.pipeline_id)
      }

      // Close modal after reporting operation
      setActiveModal(null)

      const result = await executeAction(action, payload)

      if (action === 'delete') {
        onPipelineDeleted?.()
      } else if (result && onPipelineUpdate) {
        onPipelineUpdate(result as Pipeline)
      } else if (action === 'rename' && onPipelineUpdate) {
        // For rename action, update pipeline name
        const updatedPipeline = {
          ...pipeline,
          name: payload?.name || pipeline.name,
        }
        onPipelineUpdate(updatedPipeline)
      }

      // Mark recent action for health monitoring coordination
      recentActionRef.current = { action, timestamp: Date.now() }
    } catch (error) {
      // NEW: Revert optimistic updates using centralized system
      if (action === 'stop') {
        operations.revertOptimisticUpdate(pipeline.pipeline_id, 'active')
      } else if (action === 'resume') {
        operations.revertOptimisticUpdate(pipeline.pipeline_id, 'stopped')
      } else if (action === 'terminate') {
        const currentStatus = (pipeline.status as PipelineStatus) || 'active'
        operations.revertOptimisticUpdate(pipeline.pipeline_id, currentStatus)
      }
      // Error will be shown in the header via actionState.error
    }
  }

  const handleModalCancel = () => {
    setActiveModal(null)
    clearError()
  }

  const handleMenuButtonClick = () => {
    if (menuButtonRef.current && !isMenuOpen) {
      const rect = menuButtonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap (mt-1)
        right: window.innerWidth - rect.right + window.scrollX,
      })
    }
    setIsMenuOpen(!isMenuOpen)
  }

  const handleMenuBackdropClick = () => {
    setIsMenuOpen(false)
  }

  const handleMenuItemClick = (action: () => void) => {
    action()
    setIsMenuOpen(false)
  }

  // Close menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMenuOpen])

  // Show notification when health error occurs
  useEffect(() => {
    if (healthError) {
      notify(metricsMessages.fetchHealthFailed())
    }
  }, [healthError])

  // Show notification when action error occurs
  useEffect(() => {
    if (actionState.error && actionState.lastAction) {
      const action = actionState.lastAction
      const pipelineName = pipeline.name

      switch (action) {
        case 'resume':
          notify(pipelineMessages.resumeFailed(pipelineName))
          break
        case 'stop':
          notify(pipelineMessages.stopFailed(pipelineName))
          break
        case 'terminate':
          notify(pipelineMessages.terminateFailed(pipelineName))
          break
        case 'delete':
          notify(pipelineMessages.deleteFailed(pipelineName))
          break
        case 'rename':
          notify(pipelineMessages.renameFailed())
          break
        case 'edit':
          notify(pipelineMessages.fetchFailed())
          break
        default:
          notify({
            variant: 'error',
            title: 'Action failed.',
            description: actionState.error,
            reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
            channel: 'toast',
          })
      }
      // Clear error after showing notification
      clearError()
    }
  }, [actionState.error, actionState.lastAction, pipeline.name, clearError])

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
    // NEW: Use centralized status as primary source, with health data as fallback
    let displayStatus = effectiveStatus

    // Only use health data if centralized status is not available and pipeline status is generic
    const recentAction = recentActionRef.current
    const isRecentAction = recentAction && Date.now() - recentAction.timestamp < 5000 // 5 seconds

    if (
      !centralizedStatus && // No centralized status available
      health?.overall_status &&
      !actionState.isLoading &&
      !isRecentAction &&
      (status === 'active' || !status || status === 'no_configuration')
    ) {
      // Parse backend health status to UI status using the mapping function
      const healthStatus = parsePipelineStatus(health.overall_status)
      if (healthStatus !== 'active' || status === 'no_configuration') {
        displayStatus = healthStatus
      }
    }

    switch (displayStatus) {
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

  const getBadgeLabel = (status: PipelineStatus | string) => {
    // NEW: Use centralized status as primary source, with health data as fallback
    let displayStatus = effectiveStatus

    // Only use health data if centralized status is not available and pipeline status is generic
    const recentAction = recentActionRef.current
    const isRecentAction = recentAction && Date.now() - recentAction.timestamp < 5000 // 5 seconds

    if (
      !centralizedStatus && // No centralized status available
      health?.overall_status &&
      !actionState.isLoading &&
      !isRecentAction &&
      (status === 'active' || !status || status === 'no_configuration')
    ) {
      // Parse backend health status to UI status using the mapping function
      const healthStatus = parsePipelineStatus(health.overall_status)
      if (healthStatus !== 'active' || status === 'no_configuration') {
        displayStatus = healthStatus
      }
    }

    switch (displayStatus) {
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

  const renderActionButton = (action: PipelineAction) => {
    const config = getActionConfiguration(action)
    const buttonText = getButtonText(action)
    // isActionDisabled already accounts for demo mode via the hook options
    const disabled = isActionDisabled(action)

    // Use regular Button for more flexibility with loading states and disabled state
    return (
      <Button
        key={action}
        variant="outline"
        onClick={() => handleActionClick(action)}
        disabled={disabled}
        className={`group ${action === 'resume' ? 'btn-primary' : 'btn-action'} !px-3 !py-1.5 h-auto text-sm`}
        title={config.disabledReason}
      >
        {actionState.isLoading && actionState.lastAction === action ? (
          <span className="flex items-center gap-2">
            <Image src={Loader} alt="Loading" width={14} height={14} className="animate-spin" />
            Loading...
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {action === 'resume' && (
              <Image
                src={PlayIcon}
                alt="Start"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'stop' && (
              <Image
                src={StopWhiteIcon}
                alt="Stop"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'rename' && (
              <Image
                src={RenameIcon}
                alt="Rename"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'terminate' && (
              <Image
                src={CloseIcon}
                alt="Terminate"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'delete' && (
              <Image
                src={DeleteIcon}
                alt="Delete"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            )}
            {action === 'edit' && (
              <Image
                src={EditIcon}
                alt="Edit"
                width={14}
                height={14}
                className="filter brightness-0 group-hover:brightness-0"
              />
            )}
            {buttonText}
          </div>
        )}
      </Button>
    )
  }

  const renderMenuButton = (action: PipelineAction, label: string, icon: any) => {
    const config = getActionConfiguration(action)
    // isActionDisabled already accounts for demo mode via the hook options
    const disabled = isActionDisabled(action)

    // Determine if this is a destructive action
    const isDestructive = action === 'terminate' || action === 'delete'

    return (
      <Button
        key={action}
        variant="ghost"
        className={cn(
          'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
          disabled
            ? 'text-muted-foreground cursor-not-allowed opacity-50'
            : isDestructive
              ? 'text-destructive hover:bg-[var(--color-background-neutral-faded)]'
              : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) {
            handleMenuItemClick(() => handleActionClick(action))
          }
        }}
        disabled={disabled}
        title={config.disabledReason}
      >
        <Image
          src={icon}
          alt={label}
          width={16}
          height={16}
          className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
        />
        <span className="truncate">{label}</span>
      </Button>
    )
  }

  const getActionButtons = () => {
    // Use centralized shouldShowAction from the hook (handles demo mode automatically)
    const showStop = shouldShowAction('stop')
    const showResume = shouldShowAction('resume')
    const showTerminate = shouldShowAction('terminate')
    const showDelete = shouldShowAction('delete')
    const showRename = shouldShowAction('rename')

    // Determine the single primary action based on pipeline status
    const getPrimaryAction = (): PipelineAction | null => {
      if (effectiveStatus === 'active' && showStop) return 'stop'
      if (effectiveStatus === 'stopped' && showResume) return 'resume'
      if (effectiveStatus === 'terminated' && showDelete) return 'delete'
      return null
    }

    const primaryAction = getPrimaryAction()

    return (
      <div className="flex flex-row gap-2">
        {/* Single primary action button */}
        {primaryAction && renderActionButton(primaryAction)}

        {/* More menu for all other actions */}
        <div className="relative">
          <Button
            ref={menuButtonRef}
            variant="outline"
            className="group btn-action !px-3 !py-4 text-sm h-auto w-full"
            onClick={handleMenuButtonClick}
          >
            <div className="flex items-center gap-2">
              <Image
                src={MenuWhiteIcon}
                alt="More options"
                width={16}
                height={16}
                className="filter brightness-100 group-hover:brightness-0"
              />
              {/* Other actions */}
            </div>
          </Button>

          {isMenuOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <>
                {/* Backdrop to close menu when clicking outside */}
                <div className="fixed inset-0 z-[100]" onClick={handleMenuBackdropClick} />

                {/* Menu dropdown - using fixed positioning */}
                <div
                  className="fixed z-[110] w-48 bg-[var(--color-background-regular)] border border-[var(--color-border-neutral)] rounded-md shadow-lg p-1 min-w-[160px] sm:min-w-[180px]"
                  style={{
                    top: `${menuPosition.top}px`,
                    right: `${menuPosition.right}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Show resume in menu if not primary */}
                  {showResume && primaryAction !== 'resume' && renderMenuButton('resume', 'Resume', PlayIcon)}
                  {/* Show stop in menu if not primary */}
                  {showStop && primaryAction !== 'stop' && renderMenuButton('stop', 'Stop', StopWhiteIcon)}
                  {showRename && renderMenuButton('rename', 'Rename', RenameIcon)}
                  {showTerminate && renderMenuButton('terminate', 'Terminate', CloseIcon)}
                  {/* Show delete in menu if not primary */}
                  {showDelete && primaryAction !== 'delete' && renderMenuButton('delete', 'Delete', DeleteIcon)}

                  {/* Manage Tags Button */}
                  {onManageTags && (
                    <Button
                      variant="ghost"
                      className={cn(
                        'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
                        demoMode
                          ? 'text-muted-foreground cursor-not-allowed opacity-50'
                          : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!demoMode) {
                          handleMenuItemClick(() => onManageTags())
                        }
                      }}
                      disabled={demoMode}
                      title={demoMode ? 'Action disabled in demo mode' : 'Manage tags'}
                    >
                      <TagIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Manage tags</span>
                    </Button>
                  )}

                  {/* Download Button */}
                  <Button
                    variant="ghost"
                    className={cn(
                      'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
                      'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMenuItemClick(() => handleDownloadClick())
                    }}
                    title={
                      coreStore.isDirty
                        ? 'Unsaved changes will not be included in downloaded config'
                        : 'Download configuration'
                    }
                  >
                    <Image
                      src={DownloadIcon}
                      alt="Download"
                      width={16}
                      height={16}
                      className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
                    />
                    <span className="truncate">Download config</span>
                    {coreStore.isDirty && (
                      <Badge variant="warning" className="ml-auto px-1.5 py-0.5 text-[10px] leading-none">
                        ⚠️
                      </Badge>
                    )}
                  </Button>

                  {/* Flush DLQ Button */}
                  <Button
                    variant="ghost"
                    className={cn(
                      'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
                      demoMode
                        ? 'text-muted-foreground cursor-not-allowed opacity-50'
                        : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!demoMode) {
                        handleMenuItemClick(() => handleFlushDataClick())
                      }
                    }}
                    title="Flush DLQ"
                    disabled={demoMode}
                  >
                    <Image
                      src={DeleteIcon}
                      alt="Flush"
                      width={16}
                      height={16}
                      className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
                    />
                    <span className="truncate">Flush DLQ</span>
                  </Button>

                  {/* Grafana Dashboard Button - only visible in demo mode with dashboard URL */}
                  {isDashboardAvailable() && (
                    <Button
                      variant="ghost"
                      className={cn(
                        'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
                        'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMenuItemClick(() => handleGrafanaClick())
                      }}
                      title="Open Grafana Dashboard"
                    >
                      <svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="truncate">Metrics(Grafana)</span>
                    </Button>
                  )}
                </div>
              </>,
              document.body,
            )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 transition-all duration-750 ease-out',
        showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      <Card className="card-outline py-2 px-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-4 items-start">
            <div className="flex flex-row flex-start gap-2 items-center min-w-0 flex-1">
              {actionState.isLoading && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Image src={Loader} alt="Loading" width={24} height={24} className="animate-spin" />
                  <span className="text-sm text-blue-600 font-medium whitespace-nowrap">
                    {actionState.lastAction === 'stop' && 'Stopping pipeline...'}
                    {actionState.lastAction === 'resume' && 'Resuming pipeline...'}
                    {actionState.lastAction === 'terminate' && 'Terminating pipeline...'}
                    {actionState.lastAction === 'delete' && 'Deleting pipeline...'}
                    {actionState.lastAction === 'rename' && 'Renaming pipeline...'}
                    {actionState.lastAction === 'edit' && 'Updating pipeline...'}
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-bold truncate min-w-0" title={pipeline.name}>
                {pipeline.name}
              </h2>
              <Badge variant={getStatusVariant(effectiveStatus)} className="rounded-xl my-2 mx-4 flex-shrink-0">
                {healthLoading && !centralizedStatus ? 'Checking...' : getBadgeLabel(effectiveStatus)}
              </Badge>
              {/* Debug info */}
              {/* <div className="text-xs text-gray-500">
                Debug: status={pipeline.status}, actionState.isLoading={actionState.isLoading ? 'true' : 'false'},
                lastAction={actionState.lastAction}, health={health?.overall_status || 'none'}, recentAction=
                {recentActionRef.current?.action || 'none'}
              </div> */}
            </div>
            <div className="flex flex-row flex-end gap-2 flex-shrink-0">{actions || getActionButtons()}</div>
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Tags:</span>
            {tagsList.length === 0 && <span className="text-muted-foreground">No tags yet</span>}
            {tagsList.slice(0, 6).map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {tag}
              </Badge>
            ))}
            {tagsList.length > 6 && <span className="text-xs text-muted-foreground">+{tagsList.length - 6} more</span>}
          </div>
        </div>
      </Card>

      {/* Terminate Pipeline Modal */}
      <TerminatePipelineModal
        visible={activeModal === 'terminate'}
        onOk={() => {
          handleModalConfirm('terminate', { graceful: false })
        }}
        onCancel={handleModalCancel}
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

      {/* Unsaved Changes Download Warning Modal */}
      <UnsavedChangesDownloadModal
        visible={showDownloadWarningModal}
        onOk={proceedWithDownload}
        onCancel={handleDownloadWarningCancel}
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

      {/* Stop Modal */}
      <StopPipelineModal
        visible={activeModal === 'stop'}
        onOk={() => {
          handleModalConfirm('stop')
        }}
        onCancel={handleModalCancel}
      />

      {/* Flush DLQ Modal */}
      <FlushDLQModal visible={showFlushDLQModal} onOk={handleFlushDLQConfirm} onCancel={handleFlushDLQCancel} />
    </div>
  )
}

export default PipelineDetailsHeader
