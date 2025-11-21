import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { MoreVertical, Tag } from 'lucide-react'
import { cn, isDemoMode } from '@/src/utils/common.client'
import { getActionConfig } from '@/src/utils/pipeline-actions'
import { PipelineStatus } from '@/src/types/pipeline'
import PlayIcon from '@/src/images/play-white.svg'
import RenameIcon from '@/src/images/rename.svg'
import DeleteIcon from '@/src/images/trash.svg'
import DownloadIcon from '@/src/images/download-white.svg'
import CloseIcon from '@/src/images/close.svg'
import StopWhiteIcon from '@/src/images/stop-white.svg'
import CloseWhiteIcon from '@/src/images/close-white.svg'
import Image from 'next/image'

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

  // Get action configurations based on pipeline status
  const stopConfig = getActionConfig('stop', pipelineStatus)
  const resumeConfig = getActionConfig('resume', pipelineStatus)
  const editConfig = getActionConfig('edit', pipelineStatus)
  const renameConfig = getActionConfig('rename', pipelineStatus)
  const terminateConfig = getActionConfig('terminate', pipelineStatus)
  const deleteConfig = getActionConfig('delete', pipelineStatus)

  // Determine which stop/resume action to show
  const showStop = pipelineStatus === 'active' && !stopConfig.isDisabled && !demoMode
  const showResume =
    (pipelineStatus === 'stopped' || pipelineStatus === 'terminated') && !resumeConfig.isDisabled && !demoMode
  // Terminate is a kill switch - available for all states except final states and when already terminating
  const showTerminate =
    pipelineStatus !== 'stopped' && pipelineStatus !== 'terminated' && pipelineStatus !== 'terminating' && !demoMode
  const showRename = !renameConfig?.isDisabled && !demoMode

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
            {/* Stop Button */}
            {showStop && onStop && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  stopConfig.isDisabled || isLoading
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => handleMenuClick(e, onStop, stopConfig.isDisabled || isLoading)}
                disabled={stopConfig.isDisabled || isLoading}
                title={stopConfig.disabledReason}
              >
                <Image
                  src={StopWhiteIcon}
                  alt="Stop"
                  width={16}
                  height={16}
                  className="filter brightness-100 group-hover:brightness-0"
                />
                <span className="truncate">Stop</span>
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
                <Image src={PlayIcon} alt="Resume" width={16} height={16} />
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
            {showRename && onRename && (
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
                <Image
                  src={RenameIcon}
                  alt="Rename"
                  width={16}
                  height={16}
                  className="filter brightness-100 group-hover:brightness-0"
                />
                <span className="truncate">Rename</span>
              </Button>
            )}

            {onManageTags && (
              <Button
                variant="ghost"
                className={cn(
                  'flex justify-start items-center w-full px-3 py-2 text-sm transition-colors',
                  'text-foreground hover:bg-[var(--color-background-neutral-faded)]',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMenuClick(e, onManageTags, false)
                }}
              >
                <Tag className="h-4 w-4 mr-2" />
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
                title="Immediately terminate pipeline"
              >
                <Image
                  src={CloseIcon}
                  alt="Terminate"
                  width={16}
                  height={16}
                  className="filter brightness-100 group-hover:brightness-0"
                />
                <span className="truncate">Terminate</span>
              </Button>
            )}

            {/* Delete Button */}
            {onDelete && !demoMode && (
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
                <Image
                  src={DeleteIcon}
                  alt="Delete"
                  width={16}
                  height={16}
                  className="filter brightness-100 group-hover:brightness-0"
                />
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
                <Image
                  src={DownloadIcon}
                  alt="Download"
                  width={16}
                  height={16}
                  className="filter brightness-100 group-hover:brightness-0"
                />
                <span className="truncate">Download</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
