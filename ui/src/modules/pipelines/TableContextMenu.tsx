import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { MoreVertical, Pause, Play, Edit, FileText, Trash2 } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import { getActionConfig } from '@/src/utils/pipeline-actions'
import { Pipeline, PipelineStatus } from '@/src/types/pipeline'

interface TableContextMenuProps {
  pipelineStatus: PipelineStatus
  isLoading?: boolean
  onPause?: () => void
  onResume?: () => void
  onEdit?: () => void
  onRename?: () => void
  onStop?: () => void
  onDelete?: () => void
  disabled?: boolean
  onOpen?: (e: React.MouseEvent) => void
}

export const TableContextMenu = ({
  pipelineStatus,
  isLoading = false,
  onPause,
  onResume,
  onEdit,
  onRename,
  onStop,
  onDelete,
  disabled = false,
  onOpen,
}: TableContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)

  // Get action configurations based on pipeline status
  const pauseConfig = getActionConfig('pause', pipelineStatus)
  const resumeConfig = getActionConfig('resume', pipelineStatus)
  const editConfig = getActionConfig('edit', pipelineStatus)
  const renameConfig = getActionConfig('rename', pipelineStatus)
  const stopConfig = getActionConfig('stop', pipelineStatus)
  const deleteConfig = getActionConfig('delete', pipelineStatus)
  // Determine which pause/resume action to show
  const showPause = pipelineStatus === 'active' && !pauseConfig.isDisabled
  const showResume = pipelineStatus === 'paused' && !resumeConfig.isDisabled

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
            className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--color-background-regular)] border border-[var(--color-border-neutral)] rounded-md shadow-lg p-1 min-w-[160px] sm:min-w-[180px]"
            onClick={(e) => e.stopPropagation()} // Prevent any clicks in the menu from bubbling to parent
          >
            {/* Pause Button */}
            {showPause && onPause && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  pauseConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onPause, pauseConfig.isDisabled || isLoading)}
                disabled={pauseConfig.isDisabled || isLoading}
                title={pauseConfig.disabledReason}
              >
                <Pause className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Pause</span>
              </Button>
            )}

            {/* Resume Button */}
            {showResume && onResume && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  resumeConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onResume, resumeConfig.isDisabled || isLoading)}
                disabled={resumeConfig.isDisabled || isLoading}
                title={resumeConfig.disabledReason}
              >
                <Play className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Resume</span>
              </Button>
            )}

            {/* Edit Button */}
            {/* {onEdit && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  editConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onEdit, editConfig.isDisabled || isLoading)}
                disabled={editConfig.isDisabled || isLoading}
                title={editConfig.disabledReason}
              >
                <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            )} */}

            {/* Rename Button */}
            {onRename && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  renameConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onRename, renameConfig.isDisabled || isLoading)
                }}
                disabled={renameConfig.isDisabled || isLoading}
                title={renameConfig.disabledReason}
              >
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Rename</span>
              </Button>
            )}

            {/* Stop Button */}
            {onStop && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  stopConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-destructive hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onStop, stopConfig.isDisabled || isLoading)
                }}
                disabled={stopConfig.isDisabled || isLoading}
                title={stopConfig.disabledReason}
              >
                <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Stop</span>
              </Button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  deleteConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-destructive hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation() // Always stop propagation first
                  handleMenuClick(e, onDelete, deleteConfig.isDisabled || isLoading)
                }}
                disabled={deleteConfig.isDisabled || isLoading}
                title={deleteConfig.disabledReason}
              >
                <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Delete</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
