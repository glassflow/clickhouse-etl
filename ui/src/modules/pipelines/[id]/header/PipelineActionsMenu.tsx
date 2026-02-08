'use client'

import React from 'react'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import { PipelineAction } from '@/src/types/pipeline'

// Icons
import MenuWhiteIcon from '@/public/icons/menu-white.svg'
import PlayIcon from '@/public/icons/play.svg'
import StopWhiteIcon from '@/public/icons/stop-white.svg'
import RenameIcon from '@/public/icons/rename.svg'
import CloseIcon from '@/public/icons/close.svg'
import DeleteIcon from '@/public/icons/delete.svg'
import DownloadIcon from '@/public/icons/download.svg'
import { TagIcon } from 'lucide-react'

interface ActionMenuItemConfig {
  action: PipelineAction
  label: string
  icon: any
  show: boolean
  disabled?: boolean
  disabledReason?: string
}

interface PipelineActionsMenuProps {
  /** Pipeline actions to show in menu */
  actions: ActionMenuItemConfig[]
  /** Primary action that should NOT appear in menu (shown as main button) */
  primaryAction: PipelineAction | null
  /** Callback when action is clicked */
  onAction: (action: PipelineAction) => void
  /** Whether demo mode is enabled */
  demoMode: boolean
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean
  /** Callback for download action */
  onDownload: () => void
  /** Callback for manage tags action */
  onManageTags?: () => void
  /** Callback for flush DLQ action */
  onFlushDLQ: () => void
  /** Callback for Grafana dashboard */
  onGrafana?: () => void
  /** Whether Grafana dashboard is available */
  showGrafana?: boolean
}

/**
 * Dropdown menu for pipeline actions (resume, stop, rename, terminate, delete, etc.)
 * Uses Radix DropdownMenu for accessibility and proper positioning.
 */
export function PipelineActionsMenu({
  actions,
  primaryAction,
  onAction,
  demoMode,
  hasUnsavedChanges,
  onDownload,
  onManageTags,
  onFlushDLQ,
  onGrafana,
  showGrafana = false,
}: PipelineActionsMenuProps) {
  const renderActionItem = (config: ActionMenuItemConfig) => {
    // Don't show if this is the primary action or if not supposed to show
    if (config.action === primaryAction || !config.show) {
      return null
    }

    const isDisabled = config.disabled || demoMode

    return (
      <DropdownMenuItem
        key={config.action}
        onClick={() => !isDisabled && onAction(config.action)}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer',
          isDisabled && 'opacity-50 cursor-not-allowed',
        )}
        title={isDisabled ? (config.disabledReason || 'Action disabled in demo mode') : config.label}
      >
        <Image
          src={config.icon}
          alt={config.label}
          width={16}
          height={16}
          className="filter brightness-100 flex-shrink-0"
        />
        <span className="truncate">{config.label}</span>
      </DropdownMenuItem>
    )
  }

  // Get action icons mapping
  const getActionIcon = (action: PipelineAction) => {
    switch (action) {
      case 'resume':
        return PlayIcon
      case 'stop':
        return StopWhiteIcon
      case 'rename':
        return RenameIcon
      case 'terminate':
        return CloseIcon
      case 'delete':
        return DeleteIcon
      default:
        return MenuWhiteIcon
    }
  }

  // Build action configs with icons
  const actionItems = actions.map((action) => ({
    ...action,
    icon: action.icon || getActionIcon(action.action),
  }))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="group btn-action !px-2 !py-1.5 h-auto text-sm"
          title="More actions"
        >
          <div className="flex items-center gap-1">
            <Image
              src={MenuWhiteIcon}
              alt="More options"
              width={16}
              height={16}
              className="filter brightness-100 group-hover:brightness-0"
            />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 min-w-[160px] sm:min-w-[180px]">
        {/* Pipeline actions */}
        {actionItems.map(renderActionItem)}

        {/* Manage Tags */}
        {onManageTags && (
          <DropdownMenuItem
            onClick={() => !demoMode && onManageTags()}
            disabled={demoMode}
            className={cn(
              'flex items-center gap-2 px-3 py-2 cursor-pointer',
              demoMode && 'opacity-50 cursor-not-allowed',
            )}
            title={demoMode ? 'Action disabled in demo mode' : 'Manage tags'}
          >
            <TagIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Manage tags</span>
          </DropdownMenuItem>
        )}

        {/* Download config */}
        <DropdownMenuItem
          onClick={onDownload}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
          title={hasUnsavedChanges ? 'Unsaved changes will not be included in downloaded config' : 'Download configuration'}
        >
          <Image
            src={DownloadIcon}
            alt="Download"
            width={16}
            height={16}
            className="filter brightness-100 flex-shrink-0"
          />
          <span className="truncate">Download config</span>
          {hasUnsavedChanges && (
            <Badge variant="warning" className="ml-auto px-1.5 py-0.5 text-[10px] leading-none">
              ⚠️
            </Badge>
          )}
        </DropdownMenuItem>

        {/* Flush DLQ */}
        <DropdownMenuItem
          onClick={() => !demoMode && onFlushDLQ()}
          disabled={demoMode}
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer',
            demoMode && 'opacity-50 cursor-not-allowed',
          )}
          title={demoMode ? 'Action disabled in demo mode' : 'Flush DLQ'}
        >
          <Image
            src={DeleteIcon}
            alt="Flush"
            width={16}
            height={16}
            className="filter brightness-100 flex-shrink-0"
          />
          <span className="truncate">Flush DLQ</span>
        </DropdownMenuItem>

        {/* Grafana Dashboard */}
        {showGrafana && onGrafana && (
          <DropdownMenuItem
            onClick={onGrafana}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            title="Open Grafana Dashboard"
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="filter brightness-100 flex-shrink-0"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                fill="currentColor"
              />
            </svg>
            <span className="truncate">Metrics (Grafana)</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
