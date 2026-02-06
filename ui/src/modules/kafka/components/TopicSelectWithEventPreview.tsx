'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/src/utils/common.client'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { TopicOffsetSelect } from '@/src/modules/kafka/components/TopicOffsetSelect'
import EventManager from '@/src/components/shared/event-fetcher/EventManager'
import ReplicaCount from '@/src/modules/kafka/components/ReplicaCount'

export type TopicSelectWithEventPreviewProps = {
  index: number
  initialOffset?: 'earliest' | 'latest'
  availableTopics: string[]
  existingTopic?: {
    name?: string
    initialOffset?: 'earliest' | 'latest'
    selectedEvent?: any
  }
  onTopicChange?: (topicName: string, event: any) => void
  onOffsetChange?: (offset: 'earliest' | 'latest', event: any) => void
  onManualEventChange?: (event: string) => void
  additionalContent?: React.ReactNode
  isEditingEnabled: boolean
  readOnly?: boolean
  disableTopicChange?: boolean // ✅ NEW: Specifically disable topic selection in edit mode
  topicName?: string
  offset?: 'earliest' | 'latest'
  event?: any
  isLoading?: boolean
  error?: string | null
  validationError?: string | null // Validation error for topic field (e.g. "Please select a topic")
  currentOffset?: number | null
  earliestOffset?: number | null
  latestOffset?: number | null
  isAtLatest?: boolean
  isAtEarliest?: boolean
  fetchNewestEvent?: (topicName: string) => Promise<void>
  fetchOldestEvent?: (topicName: string) => Promise<void>
  fetchNextEvent?: (topicName: string, currentOffset: number) => Promise<void>
  fetchPreviousEvent?: (topicName: string, currentOffset: number) => Promise<void>
  refreshEvent?: (topicName: string, fetchNext?: boolean) => Promise<void>
  partitionCount?: number
  replicas?: number
  onReplicaCountChange?: (replicas: number) => void
  onRefreshTopics?: () => Promise<void>
}

export function TopicSelectWithEventPreview({
  index,
  existingTopic,
  onTopicChange,
  onOffsetChange,
  onManualEventChange,
  availableTopics,
  initialOffset = INITIAL_OFFSET_OPTIONS.LATEST as 'earliest' | 'latest',
  additionalContent,
  isEditingEnabled,
  readOnly,
  disableTopicChange, // ✅ NEW: Specifically disable topic selection in edit mode
  topicName: hookTopicName,
  offset: hookOffset,
  event: hookEvent,
  isLoading: hookIsLoading,
  error: hookError,
  validationError,
  currentOffset: hookCurrentOffset,
  earliestOffset: hookEarliestOffset,
  latestOffset: hookLatestOffset,
  isAtLatest: hookIsAtLatest,
  isAtEarliest: hookIsAtEarliest,
  fetchNewestEvent: hookFetchNewestEvent,
  fetchOldestEvent: hookFetchOldestEvent,
  fetchNextEvent: hookFetchNextEvent,
  fetchPreviousEvent: hookFetchPreviousEvent,
  refreshEvent: hookRefreshEvent,
  partitionCount = 1,
  replicas = 1,
  onReplicaCountChange,
  onRefreshTopics,
}: TopicSelectWithEventPreviewProps) {
  // Use hook data if provided, otherwise fall back to local state
  const topicName = hookTopicName || existingTopic?.name || ''
  const offset = hookOffset || existingTopic?.initialOffset || initialOffset
  const event = hookEvent || existingTopic?.selectedEvent?.event || null
  const isLoading = hookIsLoading || false
  const error = hookError || null

  // Combine fetch error and validation error (validation error takes priority)
  const topicError = validationError || error || ''

  // Handle topic change
  const handleTopicChange = useCallback(
    async (topic: string) => {
      if (topic === '') return

      // Notify parent of changes
      if (onTopicChange && topic) {
        onTopicChange(topic, event)
      }
    },
    [onTopicChange, event],
  )

  // Handle offset change
  const handleOffsetChange = useCallback(
    (newOffset: 'earliest' | 'latest') => {
      // Notify parent of changes
      if (onOffsetChange) {
        onOffsetChange(newOffset, event)
      }
    },
    [onOffsetChange, event],
  )

  // Handle manual event change
  const handleManualEventChange = useCallback(
    (manualEvent: string) => {
      if (onManualEventChange) {
        onManualEventChange(manualEvent)
      }
    },
    [onManualEventChange],
  )

  // Handle replica count change
  const handleReplicaCountChange = useCallback(
    (replicas: number) => {
      if (onReplicaCountChange) {
        onReplicaCountChange(replicas)
      }
    },
    [onReplicaCountChange],
  )

  return (
    <div className="flex flex-row gap-6 w-full">
      {/* Form Fields */}
      <div
        className={cn(
          'flex-[2] min-w-0 space-y-4',
          isLoading && 'opacity-50 pointer-events-none transition-opacity duration-200',
        )}
      >
        <h3 className="text-md font-medium step-description">
          This Kafka topic will be used as the data source of your pipeline.
        </h3>
        <div className="flex flex-col gap-4 pt-8">
          <TopicOffsetSelect
            index={index}
            topicValue={topicName}
            isLoadingEvent={isLoading}
            offsetValue={offset}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onBlur={() => {}}
            onOpenChange={() => {}}
            topicError={topicError}
            offsetError={''}
            topicPlaceholder="Select a topic"
            offsetPlaceholder="Select initial offset"
            topicOptions={availableTopics.map((topic) => ({ label: topic, value: topic }))}
            offsetOptions={Object.entries(INITIAL_OFFSET_OPTIONS).map(([key, value]) => ({
              label: value,
              value: value as 'earliest' | 'latest',
            }))}
            readOnly={readOnly}
            disableTopicChange={disableTopicChange} // ✅ Pass down the new prop
            onRefreshTopics={onRefreshTopics}
          />

          {/* Replica Count Selection */}
          {topicName && (
            <ReplicaCount
              partitionCount={partitionCount}
              replicas={replicas}
              onReplicaCountChange={handleReplicaCountChange}
              index={index}
              readOnly={readOnly}
              isLoading={isLoading}
            />
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-content">
              <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
              <span>Fetching the event schema...</span>
            </div>
          )}

          {/* Additional content slot */}
          {additionalContent}
        </div>
      </div>

      {/* Event Preview */}
      <div className="flex-[3] min-w-0 min-h-[450px] h-full">
        <EventManager
          topicName={topicName}
          initialOffset={offset}
          topicIndex={index}
          initialEvent={event}
          isEditingEnabled={isEditingEnabled}
          onEventLoading={() => {
            // Loading is handled by the hook
          }}
          onEventLoaded={(eventData) => {
            // Event loading is handled by the hook
          }}
          onEventError={(error) => {
            // Error handling is done by the hook
          }}
          onEmptyTopic={() => {
            // Empty topic handling is done by the hook
          }}
          onManualEventChange={handleManualEventChange}
          readOnly={readOnly}
          isLoading={isLoading}
          currentOffset={hookCurrentOffset}
          earliestOffset={hookEarliestOffset}
          latestOffset={hookLatestOffset}
          isAtLatest={hookIsAtLatest}
          isAtEarliest={hookIsAtEarliest}
          fetchNewestEvent={hookFetchNewestEvent}
          fetchOldestEvent={hookFetchOldestEvent}
          fetchNextEvent={hookFetchNextEvent}
          fetchPreviousEvent={hookFetchPreviousEvent}
          refreshEvent={hookRefreshEvent}
        />
      </div>
    </div>
  )
}
