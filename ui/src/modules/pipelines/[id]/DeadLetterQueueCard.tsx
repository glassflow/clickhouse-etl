'use client'

import { Card } from '@/src/components/ui/card'
import DeadLetterQueueIcon from '@/src/images/dlq2.svg'
import MaximizeIcon from '@/src/images/maximize-2.svg'
import MinimizeIcon from '@/src/images/minimize-2.svg'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { getDLQState } from '@/src/api/pipeline-api'
import { DLQState } from '@/src/types/pipeline'
import { formatRelativeTime } from '@/src/utils/common.client'
import { notify } from '@/src/notifications'
import { dlqMessages } from '@/src/notifications/messages'

// ── Helpers ────────────────────────────────────────────────────────────────────

// Guards against null, empty, zero-epoch, invalid, and future timestamps
function safeRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp || timestamp === '0') return '—'
  const d = new Date(timestamp)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getTime() > Date.now()) return '—'
  return formatRelativeTime(timestamp)
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCell() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-4 w-10 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
      <div className="h-3 w-14 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <Card variant="outline" className="py-4 px-6 mb-4 w-full">
      <div className="flex flex-col gap-5">
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <div className="w-5 h-5 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
            <div className="h-4 w-36 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCell key={i} />
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── Metric primitives ──────────────────────────────────────────────────────────

function MetricCell({
  value,
  label,
  accent,
}: {
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`title-6 tabular-nums leading-tight ${
          accent
            ? 'text-[var(--color-foreground-primary)]'
            : 'text-[var(--color-foreground-neutral)]'
        }`}
      >
        {value}
      </span>
      <span className="caption-1 text-[var(--color-foreground-neutral-faded)]">{label}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

function DeadLetterQueueCard({
  pipelineId,
  refreshTrigger,
}: {
  pipelineId: string
  refreshTrigger?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [rawState, setRawState] = useState<DLQState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks last seen pipelineId to distinguish new-pipeline loads from trigger-based refreshes
  const prevPipelineId = useRef<string | null>(null)

  useEffect(() => {
    if (!pipelineId) return

    let cancelled = false

    const isNewPipeline = prevPipelineId.current !== pipelineId
    prevPipelineId.current = pipelineId

    if (isNewPipeline) {
      // Full reset — show skeleton for a brand-new pipeline
      setRawState(null)
      setIsLoading(true)
    } else {
      // Parent-triggered refresh (refreshTrigger changed) — keep existing data visible
      setIsRefreshing(true)
    }

    const fetchDLQState = async () => {
      try {
        setError(null)
        const state = await getDLQState(pipelineId)
        if (!cancelled) setRawState(state)
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch DLQ data')
          notify(dlqMessages.fetchStateFailed())
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    fetchDLQState()

    return () => {
      cancelled = true
    }
  }, [pipelineId, refreshTrigger])

  if (isLoading && rawState === null) return <LoadingSkeleton />

  const s = rawState
  const totalDlq = s ? formatCount(s.total_messages) : '—'
  const unconsumedEvents = s ? formatCount(s.unconsumed_messages) : '—'
  const lastEventReceived = s ? safeRelativeTime(s.last_received_at) : '—'
  const lastConsumedAt = s ? safeRelativeTime(s.last_consumed_at) : '—'

  return (
    <Card variant="outline" className="py-4 px-6 mb-4 w-full">
      <div className="flex flex-col gap-4">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <Image
              src={DeadLetterQueueIcon}
              alt="Dead Letter Queue"
              className="w-5 h-5"
              width={20}
              height={20}
            />
            <h3 className="title-6">Dead Letter Queue</h3>
          </div>

          <div className="flex flex-row items-center gap-3">
            {isRefreshing && (
              <span className="caption-1 animate-pulse text-[var(--color-foreground-primary)]">
                Refreshing…
              </span>
            )}
            {s && (
              <button
                type="button"
                aria-label={isExpanded ? 'Collapse DLQ metrics' : 'Expand DLQ metrics'}
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100 transition-opacity duration-150"
              >
                <Image
                  src={isExpanded ? MinimizeIcon : MaximizeIcon}
                  alt=""
                  aria-hidden="true"
                  className="w-4 h-4"
                  width={16}
                  height={16}
                />
              </button>
            )}
          </div>
        </div>

        {/* Inline error — card stays visible */}
        {error && (
          <p className="caption-1 text-[var(--color-foreground-critical)] animate-fadeIn">
            {error}
          </p>
        )}

        {s && (
          <>
            {/* ── Collapsed: primary stat ──────────────────── */}
            <div className={`smooth-expand ${isExpanded ? 'collapsed' : 'expanded'}`}>
              <div className="pb-1">
                <MetricCell value={unconsumedEvents} label="Unconsumed events" accent />
              </div>
            </div>

            {/* ── Expanded: 2×2 metric grid ────────────────── */}
            <div className={`smooth-expand ${isExpanded ? 'expanded' : 'collapsed'}`}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 pb-1">
                <MetricCell value={totalDlq} label="Total events" />
                <MetricCell value={unconsumedEvents} label="Unconsumed" accent />
                <MetricCell value={lastEventReceived} label="Last received" />
                <MetricCell value={lastConsumedAt} label="Last consumed" />
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export default DeadLetterQueueCard
