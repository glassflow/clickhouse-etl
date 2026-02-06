'use client'

import React from 'react'
import { cn } from '@/src/utils/common.client'
import { Pipeline } from '@/src/types/pipeline'
import { getSidebarItems, type SidebarSection, type SidebarItem } from './sidebar'

// Re-export types for backwards compatibility
export type { SidebarSection, SidebarItem }
export { getSidebarItems }

interface PipelineDetailsSidebarProps {
  pipeline: Pipeline
  activeSection: SidebarSection | null
  onSectionClick: (section: SidebarSection) => void
  disabled?: boolean
}

export function PipelineDetailsSidebar({
  pipeline,
  activeSection,
  onSectionClick,
  disabled = false,
}: PipelineDetailsSidebarProps) {
  const items = getSidebarItems(pipeline)

  return (
    <nav className="shrink-0 min-w-[200px]">
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = activeSection === item.key
          // All items are clickable except when disabled (except monitor which is always clickable)
          const isClickable = !disabled || item.key === 'monitor'

          return (
            <button
              key={item.key}
              onClick={() => onSectionClick(item.key)}
              disabled={disabled && item.key !== 'monitor'}
              className={cn(
                'relative flex items-center justify-between w-full py-2 px-3 rounded-md bg-transparent border-none cursor-default transition-all duration-150 ease-out text-left',
                isActive && 'bg-[var(--color-background-elevation-raised)]',
                !isActive && isClickable && 'hover:bg-[var(--color-background-neutral-faded)]',
                isClickable && 'cursor-pointer',
                disabled && item.key !== 'monitor' && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium text-content',
                  !isActive && 'text-[var(--color-foreground-neutral-faded)]',
                  isActive && 'font-semibold text-[var(--color-foreground-neutral)]',
                )}
              >
                {item.label}
              </span>
              {isActive && <span className="text-lg text-[var(--color-foreground-primary)] font-bold">›</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default PipelineDetailsSidebar
