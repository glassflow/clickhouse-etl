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
  | 'left-topic'
  | 'right-topic'
  | 'filter'
  | 'deduplicate'
  | 'left-deduplicate'
  | 'right-deduplicate'
  | 'join'
  | 'clickhouse-connection'
  | 'destination'

export interface SidebarItem {
  key: SidebarSection
  label: string
  stepKey?: StepKeys // The step key to activate when clicked
  topicIndex?: number // Topic index for multi-topic deduplication (0 = left, 1 = right)
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
  ]

  // Check topics configuration
  const topics = pipeline?.source?.topics || []
  const topicCount = topics.length
  const isMultiTopic = topicCount > 1

  // Check if pipeline has join enabled
  const hasJoin = pipeline?.join?.enabled === true

  if (isMultiTopic) {
    // Multi-topic pipeline: show Left Topic and Right Topic
    // Check if left topic has deduplication
    const leftTopicHasDedup = topics[0]?.deduplication?.enabled === true

    // Use combined step key (TOPIC_DEDUPLICATION_CONFIGURATOR) when topic has dedup
    items.push({
      key: 'left-topic',
      label: leftTopicHasDedup ? 'Left Topic & Dedup' : 'Left Topic',
      stepKey: leftTopicHasDedup ? StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 : StepKeys.TOPIC_SELECTION_1,
      topicIndex: 0,
    })

    // Check if right topic has deduplication
    const rightTopicHasDedup = topics[1]?.deduplication?.enabled === true

    // Use combined step key (TOPIC_DEDUPLICATION_CONFIGURATOR) when topic has dedup
    items.push({
      key: 'right-topic',
      label: rightTopicHasDedup ? 'Right Topic & Dedup' : 'Right Topic',
      stepKey: rightTopicHasDedup ? StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2 : StepKeys.TOPIC_SELECTION_2,
      topicIndex: 1,
    })

    // Add Join Configuration for multi-topic pipelines
    if (hasJoin) {
      items.push({ key: 'join', label: 'Join Configuration', stepKey: StepKeys.JOIN_CONFIGURATOR })
    }
  } else {
    // Single topic pipeline
    // Check if single topic has deduplication
    const hasDeduplication = topics[0]?.deduplication?.enabled === true

    // For single topic, keep Topic and Deduplicate as separate items
    items.push({ key: 'topic', label: 'Topic', stepKey: StepKeys.TOPIC_SELECTION_1, topicIndex: 0 })

    if (hasDeduplication) {
      items.push({ key: 'deduplicate', label: 'Deduplicate', stepKey: StepKeys.DEDUPLICATION_CONFIGURATOR, topicIndex: 0 })
    }
  }

  // Add Filter section (placeholder for future)
  items.push({ key: 'filter', label: 'Filter' })

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
