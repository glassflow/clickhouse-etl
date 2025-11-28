'use client'

import React from 'react'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import { Pipeline } from '@/src/types/pipeline'

// Define the section types for the sidebar
export type SidebarSection =
  | 'monitor'
  | 'kafka-connection'
  | 'topic'
  | 'filter'
  | 'deduplicate'
  | 'clickhouse-connection'
  | 'destination'

export interface SidebarItem {
  key: SidebarSection
  label: string
  stepKey?: StepKeys // The step key to activate when clicked
}

interface PipelineDetailsSidebarProps {
  pipeline: Pipeline
  activeSection: SidebarSection | null
  onSectionClick: (section: SidebarSection) => void
  disabled?: boolean
}

// Get sidebar items based on pipeline configuration
export function getSidebarItems(pipeline: Pipeline): SidebarItem[] {
  const items: SidebarItem[] = [
    { key: 'monitor', label: 'Monitor' },
    { key: 'kafka-connection', label: 'Kafka Connection', stepKey: StepKeys.KAFKA_CONNECTION },
    { key: 'topic', label: 'Topic', stepKey: StepKeys.TOPIC_SELECTION_1 },
  ]

  // Check if pipeline has deduplication
  const topics = pipeline?.source?.topics || []
  const hasDeduplication = topics.some((topic: any) => topic?.deduplication?.enabled)

  // Add Filter section (placeholder for future)
  items.push({ key: 'filter', label: 'Filter' })

  // Add Deduplicate section if enabled
  if (hasDeduplication) {
    items.push({ key: 'deduplicate', label: 'Deduplicate', stepKey: StepKeys.DEDUPLICATION_CONFIGURATOR })
  }

  // Add ClickHouse sections
  items.push({ key: 'clickhouse-connection', label: 'ClickHouse Connection', stepKey: StepKeys.CLICKHOUSE_CONNECTION })
  items.push({ key: 'destination', label: 'Destination', stepKey: StepKeys.CLICKHOUSE_MAPPER })

  return items
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
          // Filter is a placeholder, so it's not clickable
          const isPlaceholder = item.key === 'filter'

          return (
            <button
              key={item.key}
              onClick={() => !isPlaceholder && onSectionClick(item.key)}
              disabled={(disabled && item.key !== 'monitor') || isPlaceholder}
              className={cn(
                'relative flex items-center justify-between w-full py-2 px-3 rounded-md bg-transparent border-none cursor-default transition-all duration-150 ease-out text-left',
                isActive && 'bg-[var(--color-background-elevation-raised)]',
                !isActive && isClickable && !isPlaceholder && 'hover:bg-[var(--color-background-neutral-faded)]',
                isClickable && !isPlaceholder && 'cursor-pointer',
                disabled && item.key !== 'monitor' && 'opacity-60',
                isPlaceholder && 'opacity-40 cursor-not-allowed',
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
