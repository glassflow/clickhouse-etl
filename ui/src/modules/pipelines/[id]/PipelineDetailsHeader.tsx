'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { Copy, Check, MoreVertical } from 'lucide-react'
import TerminatePipelineModal from '@/src/modules/pipelines/components/TerminatePipelineModal'
import RenamePipelineModal from '@/src/modules/pipelines/components/RenamePipelineModal'
import StopPipelineModal from '@/src/modules/pipelines/components/StopPipelineModal'
import UnsavedChangesDownloadModal from '@/src/modules/pipelines/components/UnsavedChangesDownloadModal'
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
import { PipelineStatus, parsePipelineStatus } from '@/src/types/pipeline'
import { usePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineState'
import { downloadPipelineConfig } from '@/src/utils/pipeline-download'
import { isDemoMode } from '@/src/utils/common.client'
import { cn } from '@/src/utils/common.client'
import { purgePipelineDLQ } from '@/src/api/pipeline-api'
import { notify } from '@/src/notifications'
import { pipelineMessages, metricsMessages } from '@/src/notifications/messages'

interface PipelineDetailsHeaderProps {
  pipeline: Pipeline
  onPipelineUpdate?: (updatedPipeline: Pipeline) => void
  onPipelineDeleted?: () => void
  actions?: React.ReactNode
  showHeader?: boolean
}

function PipelineDetailsHeader({
  pipeline,
  onPipelineUpdate,
  onPipelineDeleted,
  actions,
  showHeader = true,
}: PipelineDetailsHeaderProps) {
  const [activeModal, setActiveModal] = useState<PipelineAction | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDownloadWarningModal, setShowDownloadWarningModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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

  const {
    actionState,
    executeAction,
    getActionConfiguration,
    getButtonText,
    isActionDisabled,
    shouldShowModal,
    clearError,
  } = usePipelineActions(pipelineWithEffectiveStatus)

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
            })

            // Send edit request to backend
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
        const result = await executeAction(action)

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
          } = useStore.getState()

          // Reset all stores that depend on pipeline configuration
          currentTopicsStore.resetTopicsStore()
          currentDeduplicationStore.resetDeduplicationStore()
          currentJoinStore.resetJoinStore()

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

  const handleFlushDataClick = async () => {
    try {
      await purgePipelineDLQ(pipeline.pipeline_id)
    } catch (error) {
      notify({
        variant: 'error',
        title: 'Failed to purge error queue.',
        description: 'The error queue could not be cleared.',
        action: { label: 'Try again', onClick: handleFlushDataClick },
        reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
        channel: 'toast',
      })
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
    const disabled = isActionDisabled(action)
    const demoMode = isDemoMode()

    // Disable pipeline control actions in demo mode (except download and rename)
    const isDemoDisabled = demoMode && ['stop', 'resume', 'terminate', 'delete'].includes(action)
    const finalDisabled = disabled || isDemoDisabled
    const finalTitle = isDemoDisabled ? 'Action disabled in demo mode' : config.disabledReason

    // Use regular Button for more flexibility with loading states and disabled state
    return (
      <Button
        key={action}
        variant="outline"
        onClick={() => handleActionClick(action)}
        disabled={finalDisabled}
        className={`group ${action === 'resume' ? 'btn-primary' : 'btn-action'} !px-3 !py-1.5 h-auto text-sm`}
        title={finalTitle}
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
    const disabled = isActionDisabled(action)
    const demoMode = isDemoMode()

    // Disable pipeline control actions in demo mode (except download and rename)
    const isDemoDisabled = demoMode && ['stop', 'resume', 'terminate', 'delete'].includes(action)
    const finalDisabled = disabled || isDemoDisabled

    // Determine if this is a destructive action
    const isDestructive = action === 'terminate' || action === 'delete'

    return (
      <Button
        key={action}
        variant="ghost"
        className={cn(
          'flex justify-start items-center gap-2 w-full px-3 py-2 text-sm transition-colors h-auto',
          finalDisabled
            ? 'text-muted-foreground cursor-not-allowed opacity-50'
            : isDestructive
              ? 'text-destructive hover:bg-[var(--color-background-neutral-faded)]'
              : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (!finalDisabled) {
            handleMenuItemClick(() => handleActionClick(action))
          }
        }}
        disabled={finalDisabled}
        title={isDemoDisabled ? 'Action disabled in demo mode' : config.disabledReason}
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
    // Use effective status (centralized status takes priority)
    const showStop = effectiveStatus === 'active' || effectiveStatus === 'stopping'
    const showResume = effectiveStatus === 'stopped' || effectiveStatus === 'terminated'

    // Terminate is a kill switch - available for all states except final states (stopped/terminated) and transitional terminating state
    const showTerminate =
      effectiveStatus !== 'stopped' && effectiveStatus !== 'terminated' && effectiveStatus !== 'terminating'
    const showDelete = effectiveStatus === 'stopped' || effectiveStatus === 'terminated'

    // Check if rename should be shown (not disabled)
    const renameConfig = getActionConfiguration('rename')
    const showRename = !renameConfig.isDisabled

    // Collect all menu items
    const menuItems = []
    if (showResume) menuItems.push({ action: 'resume' as PipelineAction, label: 'Resume pipeline' })
    if (showRename) menuItems.push({ action: 'rename' as PipelineAction, label: 'Rename pipeline' })
    if (showTerminate) menuItems.push({ action: 'terminate' as PipelineAction, label: 'Terminate pipeline' })
    if (showDelete) menuItems.push({ action: 'delete' as PipelineAction, label: 'Delete pipeline' })
    if (showStop) menuItems.push({ action: 'stop' as PipelineAction, label: 'Stop pipeline' })

    return (
      <>
        {/* Desktop: Show primary action inline, others in menu on medium screens */}
        {/* Mobile: Show only most important actions inline */}

        {/* Always visible primary actions */}
        <div className="hidden xl:flex xl:flex-row xl:gap-2">
          {showResume && renderActionButton('resume')}
          {showStop && renderActionButton('stop')}
          {showRename && renderActionButton('rename')}
          {showTerminate && renderActionButton('terminate')}
          {showDelete && renderActionButton('delete')}

          <Button
            key="download"
            variant="outline"
            onClick={() => handleDownloadClick()}
            disabled={false}
            className={`group btn-action relative !px-3 !py-1.5 h-auto text-sm`}
            title={
              coreStore.isDirty ? 'Unsaved changes will not be included in downloaded config' : 'Download configuration'
            }
          >
            <div className="flex items-center gap-2">
              <Image
                src={DownloadIcon}
                alt="Download"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
              {coreStore.isDirty && (
                <Badge
                  variant="warning"
                  className="ml-1 px-1.5 py-0.5 text-[10px] leading-none"
                  title="Unsaved changes"
                >
                  ⚠️
                </Badge>
              )}
            </div>
            Download config
          </Button>

          <Button
            key="flush-dlq"
            variant="outline"
            onClick={() => handleFlushDataClick()}
            disabled={false}
            className={`group btn-action relative !px-3 !py-1.5 h-auto text-sm`}
            title={'Flush DLQ'}
          >
            <div className="flex items-center gap-2">
              <Image
                src={DeleteIcon}
                alt="Download"
                width={14}
                height={14}
                className="filter brightness-100 group-hover:brightness-0"
              />
            </div>
            Flush DLQ
          </Button>
        </div>

        {/* Tablet/Mobile: Show most critical actions + More menu */}
        <div className="flex xl:hidden flex-row gap-2">
          {/* Show primary action inline */}
          {showResume && renderActionButton('resume')}
          {showStop && renderActionButton('stop')}

          {/* More menu for remaining actions */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0 hover:bg-muted')}
              onClick={handleMenuButtonClick}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {isMenuOpen && (
              <>
                {/* Backdrop to close menu when clicking outside */}
                <div className="fixed inset-0 z-10" onClick={handleMenuBackdropClick} />

                {/* Menu dropdown */}
                <div
                  className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--color-background-regular)] border border-[var(--color-border-neutral)] rounded-md shadow-lg p-1 min-w-[160px] sm:min-w-[180px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {showRename && renderMenuButton('rename', 'Rename', RenameIcon)}
                  {showTerminate && renderMenuButton('terminate', 'Terminate', CloseIcon)}
                  {showDelete && renderMenuButton('delete', 'Delete', DeleteIcon)}

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
                      'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMenuItemClick(() => handleFlushDataClick())
                    }}
                    title="Flush DLQ"
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
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 transition-all duration-750 ease-out',
        showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2">
            <div className="flex flex-row flex-start gap-2 items-center">
              {actionState.isLoading && (
                <div className="flex items-center gap-2">
                  <Image src={Loader} alt="Loading" width={24} height={24} className="animate-spin" />
                  <span className="text-sm text-blue-600 font-medium">
                    {actionState.lastAction === 'stop' && 'Stopping pipeline...'}
                    {actionState.lastAction === 'resume' && 'Resuming pipeline...'}
                    {actionState.lastAction === 'terminate' && 'Terminating pipeline...'}
                    {actionState.lastAction === 'delete' && 'Deleting pipeline...'}
                    {actionState.lastAction === 'rename' && 'Renaming pipeline...'}
                    {actionState.lastAction === 'edit' && 'Updating pipeline...'}
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-bold">{pipeline.name}</h2>
              <Badge variant={getStatusVariant(effectiveStatus)} className="rounded-xl my-2 mx-4">
                {healthLoading && !centralizedStatus ? 'Checking...' : getBadgeLabel(effectiveStatus)}
              </Badge>
              {/* Debug info */}
              {/* <div className="text-xs text-gray-500">
                Debug: status={pipeline.status}, actionState.isLoading={actionState.isLoading ? 'true' : 'false'},
                lastAction={actionState.lastAction}, health={health?.overall_status || 'none'}, recentAction=
                {recentActionRef.current?.action || 'none'}
              </div> */}
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
    </div>
  )
}

export default PipelineDetailsHeader
