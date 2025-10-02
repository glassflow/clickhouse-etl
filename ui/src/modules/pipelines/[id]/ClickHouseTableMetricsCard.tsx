'use client'

import { Card } from '@/src/components/ui/card'
import ClickHouseIcon from '@/src/images/clickhouse.svg'
import MaximizeIcon from '@/src/images/maximize-2.svg'
import MinimizeIcon from '@/src/images/minimize-2.svg'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { getClickHouseMetricsFromConfig, ClickHouseTableMetrics } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'

interface ClickHouseMetricsDisplay {
  rowCount: string
  insertRateRows: string
  insertRateBytes: string
  latencyP50: string
  latencyP95: string
  tableSize: string
  queryMemory: string
  activeQueries: string
  failedInserts: string
  lastUpdated: string
}

const defaultMetrics: ClickHouseMetricsDisplay = {
  rowCount: '0',
  insertRateRows: '0 rows/sec',
  insertRateBytes: '0 B/sec',
  latencyP50: '0ms',
  latencyP95: '0ms',
  tableSize: '0B',
  queryMemory: '0B',
  activeQueries: '0',
  failedInserts: '0',
  lastUpdated: '-',
}

// Helper function to format numbers with appropriate units
const formatNumber = (num: number): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toString()
}

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)}TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)}KB`
  return `${bytes}B`
}

// Helper function to format relative time with live seconds for recent updates
const formatRelativeTime = (timestamp: string | null, currentTime?: Date): string => {
  if (!timestamp || timestamp === '' || timestamp === '0') return '-'

  const now = currentTime || new Date()
  const eventTime = new Date(timestamp)

  if (isNaN(eventTime.getTime()) || eventTime.getFullYear() < 2000) {
    return '-'
  }

  const diffMs = now.getTime() - eventTime.getTime()
  if (diffMs < 0) return '-'

  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)

  // Show live seconds for updates within the last minute
  if (diffSeconds < 5) return 'Just now'
  if (diffSeconds < 60) return `${diffSeconds} sec. ago`
  if (diffMinutes < 60) return `${diffMinutes} min. ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 365) return 'Over a year ago'

  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

// Helper function to convert ClickHouseTableMetrics to display format
const convertToDisplayMetrics = (metrics: ClickHouseTableMetrics): ClickHouseMetricsDisplay => {
  return {
    rowCount: formatNumber(metrics.rowCount),
    insertRateRows: `${formatNumber(Math.round(metrics.insertRateRowsPerSec))} rows/sec`,
    insertRateBytes: `${formatBytes(Math.round(metrics.insertRateBytesPerSec))}/sec`,
    latencyP50: `${Math.round(metrics.insertLatencyP50Ms)}ms`,
    latencyP95: `${Math.round(metrics.insertLatencyP95Ms)}ms`,
    tableSize: formatBytes(metrics.compressedSizeBytes),
    queryMemory: formatBytes(metrics.memoryUsageBytes),
    activeQueries: formatNumber(metrics.activeQueries),
    failedInserts: formatNumber(metrics.failedInsertsLast5Min),
    lastUpdated: formatRelativeTime(metrics.lastUpdated),
  }
}

const renderMinimizedView = ({ rowCount, insertRateRows }: { rowCount: string; insertRateRows: string }) => {
  return (
    <div className="flex flex-row gap-2 items-center">
      <div className="flex flex-row gap-2 items-center">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-md font-bold">{rowCount}</span>
        <span className="text-sm font-normal">rows</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-md font-bold">{insertRateRows}</span>
      </div>
    </div>
  )
}

const renderExpandedView = ({
  rowCount,
  insertRateRows,
  insertRateBytes,
  latencyP50,
  latencyP95,
  tableSize,
  queryMemory,
  activeQueries,
  failedInserts,
  lastUpdated,
}: ClickHouseMetricsDisplay) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{rowCount}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Total rows</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{insertRateRows}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Insert rate (rows)</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{insertRateBytes}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Insert rate (bytes)</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{latencyP50}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Latency P50</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{latencyP95}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Latency P95</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{tableSize}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Table size (disk)</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{queryMemory}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Query memory</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{activeQueries}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Active queries</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{failedInserts}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Failed inserts (5min)</span>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <span className="text-md font-bold">{lastUpdated}</span>
        <span className="text-sm font-normal text-[var(--color-foreground-neutral-faded)]">Last updated</span>
      </div>
    </div>
  )
}

function ClickHouseTableMetricsCard({ pipeline }: { pipeline: Pipeline }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [metrics, setMetrics] = useState<ClickHouseMetricsDisplay>(defaultMetrics)
  const [rawMetrics, setRawMetrics] = useState<ClickHouseTableMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live timer for "Last updated" - updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Update display metrics when currentTime changes (for live "Last updated")
  useEffect(() => {
    if (rawMetrics) {
      setMetrics({
        rowCount: formatNumber(rawMetrics.rowCount),
        insertRateRows: `${formatNumber(Math.round(rawMetrics.insertRateRowsPerSec))} rows/sec`,
        insertRateBytes: `${formatBytes(Math.round(rawMetrics.insertRateBytesPerSec))}/sec`,
        latencyP50: `${Math.round(rawMetrics.insertLatencyP50Ms)}ms`,
        latencyP95: `${Math.round(rawMetrics.insertLatencyP95Ms)}ms`,
        tableSize: formatBytes(rawMetrics.compressedSizeBytes),
        queryMemory: formatBytes(rawMetrics.memoryUsageBytes),
        activeQueries: formatNumber(rawMetrics.activeQueries),
        failedInserts: formatNumber(rawMetrics.failedInsertsLast5Min),
        lastUpdated: formatRelativeTime(rawMetrics.lastUpdated, currentTime),
      })
    }
  }, [currentTime, rawMetrics])

  useEffect(() => {
    const fetchClickHouseMetrics = async () => {
      try {
        setLoading(true)
        setError(null)
        const fetchedMetrics = await getClickHouseMetricsFromConfig(pipeline)
        setRawMetrics(fetchedMetrics)
        setMetrics(convertToDisplayMetrics(fetchedMetrics))
      } catch (err: any) {
        console.error('Failed to fetch ClickHouse metrics:', err)

        // Handle specific error cases
        if (err.code === 404) {
          setError('Pipeline not found in backend')
        } else if (err.message?.includes('Pipeline does not have a ClickHouse sink')) {
          setError('Pipeline does not have a ClickHouse sink')
        } else {
          setError(err.message || 'Failed to fetch ClickHouse metrics')
        }

        setMetrics(defaultMetrics)
        setRawMetrics(null)
      } finally {
        setLoading(false)
      }
    }

    if (pipeline?.pipeline_id) {
      fetchClickHouseMetrics()

      // Set up polling every 30 seconds
      const interval = setInterval(fetchClickHouseMetrics, 30000)
      return () => clearInterval(interval)
    }
  }, [pipeline])

  // Calculate height when content changes - use requestAnimationFrame to ensure DOM has updated
  useEffect(() => {
    if (contentRef.current) {
      // Use requestAnimationFrame to wait for DOM to fully render
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const height = contentRef.current.scrollHeight
          // Add small buffer to prevent cut-off
          setContentHeight(height + 4)
        }
      })
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
      <Card className="border-[var(--color-border-neutral)] radius-large py-4 px-6 mb-4 w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2 items-center">
            <div className="flex flex-start flex-row gap-2 items-center">
              <Image src={ClickHouseIcon} alt="ClickHouse Table Metrics" className="w-6 h-6" width={24} height={24} />
              <h3 className="text-lg font-bold">ClickHouse Table Metrics</h3>
            </div>
            <div className="w-6 h-6" /> {/* Placeholder for expand button */}
          </div>
          <div className="text-sm text-muted-foreground animate-pulse">Loading ClickHouse metrics...</div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-[var(--color-border-neutral)] radius-large py-4 px-6 mb-4 w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2 items-center">
            <div className="flex flex-start flex-row gap-2 items-center">
              <Image src={ClickHouseIcon} alt="ClickHouse Table Metrics" className="w-6 h-6" width={24} height={24} />
              <h3 className="text-lg font-bold">ClickHouse Table Metrics</h3>
            </div>
            <div className="w-6 h-6" /> {/* Placeholder for expand button */}
          </div>
          <div className="text-sm text-muted-foreground animate-fadeIn">Missing ClickHouse metrics: {error}</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-[var(--color-border-neutral)] radius-large py-4 px-6 mb-4 w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row justify-between gap-2 items-center">
          <div className="flex flex-start flex-row gap-2 items-center">
            <Image src={ClickHouseIcon} alt="ClickHouse Table Metrics" className="w-6 h-6" width={24} height={24} />
            <h3 className="text-lg font-bold">ClickHouse Table Metrics</h3>
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
          className="transition-all duration-300 ease-out"
          style={{
            maxHeight: isExpanded ? `${contentHeight}px` : '40px', // 40px for minimized view
            opacity: loading ? 0.7 : 1,
            overflow: 'hidden',
          }}
        >
          <div ref={contentRef} className="pb-1">
            {isExpanded ? (
              <div className="animate-fadeIn">{renderExpandedView(metrics)}</div>
            ) : (
              <div className="animate-fadeIn">
                {renderMinimizedView({ rowCount: metrics.rowCount, insertRateRows: metrics.insertRateRows })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ClickHouseTableMetricsCard
