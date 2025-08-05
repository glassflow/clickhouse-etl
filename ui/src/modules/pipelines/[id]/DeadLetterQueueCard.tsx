'use client'

import { Card } from '@/src/components/ui/card'
import DeadLetterQueueIcon from '@/src/images/dlq2.svg'
import MaximizeIcon from '@/src/images/maximize-2.svg'
import MinimizeIcon from '@/src/images/minimize-2.svg'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { getDLQState } from '@/src/api/pipeline-api'
import { DLQState } from '@/src/types/pipeline'

interface DLQMetrics {
  totalDlq: string
  lastEventReceived: string
  unconsumedEvents: string
  lastConsumedAt: string
}

const defaultMetrics: DLQMetrics = {
  totalDlq: '0',
  lastEventReceived: '-',
  unconsumedEvents: '0',
  lastConsumedAt: '-',
}

// Helper function to format numbers with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

// Helper function to format relative time
const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return '-'

  const now = new Date()
  const eventTime = new Date(timestamp)
  const diffMs = now.getTime() - eventTime.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min. ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

// Helper function to convert DLQState to DLQMetrics
const convertToMetrics = (state: DLQState): DLQMetrics => {
  return {
    totalDlq: formatNumber(state.total_messages),
    lastEventReceived: formatRelativeTime(state.last_received_at),
    unconsumedEvents: formatNumber(state.unconsumed_messages),
    lastConsumedAt: formatRelativeTime(state.last_consumed_at),
  }
}

const renderMinimizedView = ({ unconsumedEvents }: { unconsumedEvents: string }) => {
  return (
    <div className="flex flex-row gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{unconsumedEvents}</span>
        <span className="text-sm font-normal">Unconsumed events</span>
      </div>
    </div>
  )
}

const renderExpandedView = ({ totalDlq, lastEventReceived, unconsumedEvents, lastConsumedAt }: DLQMetrics) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">{totalDlq}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Total events in DLQ</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">{lastEventReceived}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Last event received</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{unconsumedEvents}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Unconsumed events</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">{lastConsumedAt}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Last consumed at</span>
      </div>
    </div>
  )
}

function DeadLetterQueueCard({ pipelineId }: { pipelineId: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [metrics, setMetrics] = useState<DLQMetrics>(defaultMetrics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    const fetchDLQState = async () => {
      try {
        setLoading(true)
        setError(null)
        const state = await getDLQState(pipelineId)
        setMetrics(convertToMetrics(state))
      } catch (err: any) {
        console.error('Failed to fetch DLQ state:', err)
        setError(err.message || 'Failed to fetch DLQ data')
        setMetrics(defaultMetrics)
      } finally {
        setLoading(false)
      }
    }

    if (pipelineId) {
      fetchDLQState()
    }
  }, [pipelineId])

  // Calculate height when content changes
  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight
      setContentHeight(height)
    }
  }, [metrics, isExpanded])

  const toggleExpand = () => {
    setIsAnimating(true)
    setIsExpanded(!isExpanded)

    // Reset animation state after animation completes
    setTimeout(() => {
      setIsAnimating(false)
    }, 300) // Match animation duration
  }

  if (loading) {
    return (
      <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4 w-2/3">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2 items-center">
            <div className="flex flex-start flex-row gap-2 items-center">
              <Image src={DeadLetterQueueIcon} alt="Dead Letter Queue" className="w-6 h-6" width={24} height={24} />
              <h3 className="text-lg font-bold">Dead Letter Queue</h3>
            </div>
            <div className="w-6 h-6" /> {/* Placeholder for expand button */}
          </div>
          <div className="text-sm text-muted-foreground animate-pulse">Loading DLQ data...</div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4 w-2/3">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2 items-center">
            <div className="flex flex-start flex-row gap-2 items-center">
              <Image src={DeadLetterQueueIcon} alt="Dead Letter Queue" className="w-6 h-6" width={24} height={24} />
              <h3 className="text-lg font-bold">Dead Letter Queue</h3>
            </div>
            <div className="w-6 h-6" /> {/* Placeholder for expand button */}
          </div>
          <div className="text-sm text-red-500 animate-fadeIn">Error: {error}</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4 w-2/3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row justify-between gap-2 items-center">
          <div className="flex flex-start flex-row gap-2 items-center">
            <Image src={DeadLetterQueueIcon} alt="Dead Letter Queue" className="w-6 h-6" width={24} height={24} />
            <h3 className="text-lg font-bold">Dead Letter Queue</h3>
          </div>
          <Image
            src={isExpanded ? MinimizeIcon : MaximizeIcon}
            alt="Toggle expand"
            className={`w-6 h-6 cursor-pointer transition-transform duration-200 hover:scale-110 ${
              isAnimating ? 'animate-pulse' : ''
            }`}
            width={24}
            height={24}
            onClick={toggleExpand}
          />
        </div>

        {/* Animated content container */}
        <div
          className="transition-all duration-300 ease-out overflow-hidden"
          style={{
            maxHeight: isExpanded ? `${contentHeight}px` : '40px', // 40px for minimized view
            opacity: loading ? 0.7 : 1,
          }}
        >
          <div ref={contentRef}>
            {isExpanded ? (
              <div className="animate-fadeIn">{renderExpandedView(metrics)}</div>
            ) : (
              <div className="animate-fadeIn">
                {renderMinimizedView({ unconsumedEvents: metrics.unconsumedEvents })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default DeadLetterQueueCard
