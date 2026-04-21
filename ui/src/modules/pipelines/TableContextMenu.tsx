import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { MoreVertical, Play, Square, Pencil, PencilLine, Trash2, Download, X, Tag } from 'lucide-react'
import { cn, isDemoMode } from '@/src/utils/common.client'
import { getActionConfig, shouldShowAction } from '@/src/utils/pipeline-actions'
import { PipelineStatus, PipelineAction } from '@/src/types/pipeline'

interface TableContextMenuProps {
  pipelineStatus: PipelineStatus
  isLoading?: boolean
  onStop?: () => void
  onResume?: () => void
  onEdit?: () => void
  onRename?: () => void
  onTerminate?: () => void
  onDelete?: () => void
  onDownload?: () => void
  onManageTags?: () => void
  disabled?: boolean
  onOpen?: (e: React.MouseEvent) => void
}

export const TableContextMenu = ({
  pipelineStatus,
  isLoading = false,
  onStop,
  onResume,
  onEdit,
  onRename,
  onTerminate,
  onDelete,
  onDownload,
  onManageTags,
  disabled = false,
  onOpen,
}: TableContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const demoMode = isDemoMode()

  // Centralized action config options (includes demo mode handling)
  const configOptions = { demoMode }

  // Helper to check if action should be shown (centralized logic)
  const canShowAction = (action: PipelineAction) => shouldShowAction(action, pipelineStatus, configOptions)

  // Get action configurations for disabled state/reason (with demo mode)
  const getConfig = (action: PipelineAction) => getActionConfig(action, pipelineStatus, configOptions)

  // Use centralized shouldShowAction for visibility
  const showStop = canShowAction('stop')
  const showResume = canShowAction('resume')
  const showEdit = canShowAction('edit')
  const showTerminate = canShowAction('terminate')
  const showRename = canShowAction('rename')
  const showDelete = canShowAction('delete')
  const editConfig = getConfig('edit')

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpen) onOpen(e)
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen)
    }
  }

  const handleMenuClick = (e: React.MouseEvent, action: () => void | undefined, actionDisabled: boolean) => {
    e.stopPropagation()

    if (!actionDisabled && action) {
      action()
    }
    setIsOpen(false)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-8 w-8 p-0 hover:bg-muted', (disabled || isLoading) && 'opacity-50 cursor-not-allowed')}
        onClick={handleButtonClick}
        disabled={disabled || isLoading}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div className="fixed inset-0 z-10" onClick={handleBackdropClick} />

          {/* Menu dropdown */}
          <div
            className="absolute right-0 top-full mt-1 z-20 w-48 surface-gradient-border border-0 bg-[var(--color-background-elevation-raised-faded-2)] shadow-lg p-1 min-w-[160px] sm:min-w-[180px] animate-slideDown"
            onClick={(e) => e.stopPropagation()} // Prevent any clicks in the menu from bubbling to parent
          >
            {/* Stop Button */}
            {showStop && onStop && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onStop, isLoading)}
                disabled={isLoading}
                title={getConfig('stop').disabledReason}
              >
                <Square className="h-4 w-4 shrink-0" />
                <span className="truncate">Stop</span>
              </Button>
            )}

            {/* Resume Button */}
            {showResume && onResume && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onResume, isLoading)}
                disabled={isLoading}
                title={getConfig('resume').disabledReason}
              >
                <Play className="h-4 w-4 shrink-0" />
                <span className="truncate">Resume</span>
              </Button>
            )}

            {/* Edit Button - for active pipeline shows "must stop first" dialog; for stopped/paused navigates to details */}
            {showEdit && onEdit && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  editConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMenuClick(e, onEdit, editConfig.isDisabled || isLoading)
                }}
                disabled={editConfig.isDisabled || isLoading}
                title={editConfig.disabledReason}
              >
                <PencilLine className="h-4 w-4 shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            )}

            {/* Rename Button */}
            {showRename && onRename && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onRename, isLoading)
                }}
                disabled={isLoading}
                title={getConfig('rename').disabledReason}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="truncate">Rename</span>
              </Button>
            )}

            {onManageTags && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  demoMode || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMenuClick(e, onManageTags, demoMode || isLoading)
                }}
                disabled={demoMode || isLoading}
                title={demoMode ? 'Action disabled in demo mode' : undefined}
              >
                <Tag className="h-4 w-4 shrink-0" />
                <span className="truncate">Edit tags</span>
              </Button>
            )}

            {/* Terminate Button - Available for all statuses except stopped/terminated (kill switch) */}
            {showTerminate && onTerminate && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-destructive hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onTerminate, isLoading)
                }}
                disabled={isLoading}
                title={getConfig('terminate').disabledReason || 'Immediately terminate pipeline'}
              >
                <X className="h-4 w-4 shrink-0" />
                <span className="truncate">Terminate</span>
              </Button>
            )}

            {/* Delete Button */}
            {showDelete && onDelete && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-destructive hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onDelete, isLoading)
                }}
                disabled={isLoading}
                title={getConfig('delete').disabledReason}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Delete</span>
              </Button>
            )}

            {/* Download Button */}
            {onDownload && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onDownload, false)
                }}
                disabled={false}
                title={`Download configuration`}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">Download</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
