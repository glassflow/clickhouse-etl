import * as React from 'react'
import { Skeleton } from '@/src/components/ui/skeleton'
import { cn } from '@/src/utils/common.client'

export type ChartFrameState = 'loading' | 'empty' | 'error' | 'populated'

type ChartFrameProps = {
  title: string
  subline?: React.ReactNode
  state: ChartFrameState
  errorMessage?: string
  height?: number
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Layout-stable chart wrapper.
 *
 * Loading / empty / error / populated all share the same outer frame so the
 * chart cells never reflow between states (cross-cutting constraints #9 and
 * #10 in the master plan).
 */
export function ChartFrame({
  title,
  subline,
  state,
  errorMessage,
  height = 180,
  children,
  actions,
  className,
}: ChartFrameProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-3 flex flex-col gap-2',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="caption-1 text-[var(--text-secondary)]">{title}</span>
          {subline && (
            <span className="caption-2 mono-2 text-[var(--text-tertiary)] truncate">
              {subline}
            </span>
          )}
        </div>
        {actions}
      </div>
      <div style={{ height }} className="relative">
        {state === 'loading' && <Skeleton width="100%" height={height} rounded="sm" />}
        {state === 'empty' && (
          <div className="absolute inset-0 flex items-center justify-center caption-1 text-[var(--text-tertiary)]">
            No data in this range
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center caption-1 text-[var(--color-foreground-critical)] text-center px-3">
            {errorMessage ?? 'Query error'}
          </div>
        )}
        {state === 'populated' && children}
      </div>
    </div>
  )
}
