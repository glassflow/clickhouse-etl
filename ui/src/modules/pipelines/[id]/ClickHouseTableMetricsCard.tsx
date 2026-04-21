'use client'

import { Card } from '@/src/components/ui/card'
import ClickHouseIcon from '@/src/images/clickhouse.svg'
import MaximizeIcon from '@/src/images/maximize-2.svg'
import MinimizeIcon from '@/src/images/minimize-2.svg'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { getClickHouseMetricsFromConfig, ClickHouseTableMetrics } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'
import { formatNumber, formatBytes, formatRelativeTime } from '@/src/utils/common.client'
import { notify } from '@/src/notifications'
import { metricsMessages } from '@/src/notifications/messages'

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
            <div className="h-4 w-44 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
          </div>
          <div className="h-3 w-20 rounded animate-pulse bg-[var(--color-background-neutral-faded)]" />
        </div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

function MetricSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="caption-1 font-medium uppercase tracking-wider text-[var(--color-foreground-neutral-faded)]">
        {heading}
      </span>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">{children}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

function ClickHouseTableMetricsCard({ pipeline }: { pipeline: Pipeline }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [rawMetrics, setRawMetrics] = useState<ClickHouseTableMetrics | null>(null)
  const [lastUpdatedStr, setLastUpdatedStr] = useState<string>('')
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks whether the next fetch is the very first one — guards full loading state
  const isFirstFetch = useRef(true)
  const [now, setNow] = useState(() => new Date())

  // 1s tick — only drives the "updated X ago" string, not a full metric recompute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (rawMetrics?.lastUpdated) {
      setLastUpdatedStr(formatRelativeTime(rawMetrics.lastUpdated, now))
    }
  // rawMetrics?.lastUpdated changes only when new data arrives; `now` ticks every second
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, rawMetrics?.lastUpdated])

  // Polling — depends on pipeline_id so parent object reference churn does not reset the interval
  useEffect(() => {
    if (!pipeline?.pipeline_id) return

    let cancelled = false
    isFirstFetch.current = true

    const fetchMetrics = async () => {
      const isFirst = isFirstFetch.current

      if (isFirst) {
        setIsInitialLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        setError(null)
        const data = await getClickHouseMetricsFromConfig(pipeline)
        if (!cancelled) {
          setRawMetrics(data)
          setLastUpdatedStr(formatRelativeTime(data.lastUpdated, new Date()))
        }
      } catch (err: any) {
        if (!cancelled) {
          let msg: string
          if (err.code === 404) {
            msg = 'Pipeline not found'
          } else if (err.message?.includes('Pipeline does not have a ClickHouse sink')) {
            msg = 'No ClickHouse sink configured'
          } else {
            msg = err.message || 'Failed to fetch metrics'
          }
          setError(msg)
          if (isFirst) setRawMetrics(null)
          notify(metricsMessages.fetchClickHouseMetricsFailed(() => fetchMetrics()))
        }
      } finally {
        if (!cancelled) {
          if (isFirst) {
            setIsInitialLoading(false)
            isFirstFetch.current = false
          } else {
            setIsRefreshing(false)
          }
        }
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // `pipeline` (full object) is captured in the closure; intentionally keyed only on id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.pipeline_id])

  if (isInitialLoading) return <LoadingSkeleton />

  // Derived display values — computed once per rawMetrics change, not on the 1s tick
  const m = rawMetrics
  const rowCount = m ? formatNumber(m.rowCount) : '—'
  const insertRateRows = m ? `${formatNumber(Math.round(m.insertRateRowsPerSec))}/s` : '—'
  const insertRateBytes = m ? `${formatBytes(Math.round(m.insertRateBytesPerSec))}/s` : '—'
  const latencyP50 = m ? `${Math.round(m.insertLatencyP50Ms)}ms` : '—'
  const latencyP95 = m ? `${Math.round(m.insertLatencyP95Ms)}ms` : '—'
  const tableSize = m ? formatBytes(m.compressedSizeBytes) : '—'
  const memory = m ? formatBytes(m.memoryUsageBytes) : '—'
  const activeQueries = m ? formatNumber(m.activeQueries) : '—'
  const failedInserts = m ? formatNumber(m.failedInsertsLast5Min) : '—'
  const merges = m ? String(m.mergesInProgress + m.mutationsInProgress) : '—'

  return (
    <Card variant="outline" className="py-4 px-6 mb-4 w-full">
      <div className="flex flex-col gap-4">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <Image
              src={ClickHouseIcon}
              alt="ClickHouse"
              className="w-5 h-5"
              width={20}
              height={20}
            />
            <h3 className="title-6">ClickHouse Table Metrics</h3>
          </div>

          <div className="flex flex-row items-center gap-3">
            {/* Live "updated X ago" — always visible in header, refreshes every second */}
            <span className="caption-1 text-[var(--color-foreground-neutral-faded)]">
              {isRefreshing ? (
                <span className="animate-pulse text-[var(--color-foreground-primary)]">
                  Refreshing…
                </span>
              ) : lastUpdatedStr ? (
                `Updated ${lastUpdatedStr}`
              ) : null}
            </span>

            {m && (
              <button
                type="button"
                aria-label={isExpanded ? 'Collapse metrics' : 'Expand metrics'}
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

        {/* Inline error — card stays visible, no full replacement */}
        {error && (
          <p className="caption-1 text-[var(--color-foreground-critical)] animate-fadeIn">
            {error}
          </p>
        )}

        {m && (
          <>
            {/* ── Collapsed: two primary stats ─────────────── */}
            <div className={`smooth-expand ${isExpanded ? 'collapsed' : 'expanded'}`}>
              <div className="flex flex-row gap-8 pb-1">
                <MetricCell value={rowCount} label="Total rows" accent />
                <MetricCell value={insertRateRows} label="Insert rate" />
              </div>
            </div>

            {/* ── Expanded: four semantic groups ───────────── */}
            <div className={`smooth-expand ${isExpanded ? 'expanded' : 'collapsed'}`}>
              <div className="flex flex-col gap-5 pb-1">
                <MetricSection heading="Throughput">
                  <MetricCell value={insertRateRows} label="Rows/sec" />
                  <MetricCell value={insertRateBytes} label="Bytes/sec" />
                </MetricSection>
                <MetricSection heading="Latency">
                  <MetricCell value={latencyP50} label="P50" />
                  <MetricCell value={latencyP95} label="P95" />
                </MetricSection>
                <MetricSection heading="Scale">
                  <MetricCell value={rowCount} label="Total rows" accent />
                  <MetricCell value={tableSize} label="Table size" />
                </MetricSection>
                <MetricSection heading="Health">
                  <MetricCell value={failedInserts} label="Failed (5 min)" />
                  <MetricCell value={activeQueries} label="Active queries" />
                  <MetricCell value={merges} label="Merges / mutations" />
                  <MetricCell value={memory} label="Memory" />
                </MetricSection>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export default ClickHouseTableMetricsCard
