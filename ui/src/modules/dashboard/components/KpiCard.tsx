'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/src/utils/common.client'

export type KpiSeverity = 'default' | 'warn' | 'crit'
export type DeltaDir = 'up' | 'down' | 'flat'

type Props = {
  label: string
  value: string
  unit?: string
  delta: string
  deltaDir: DeltaDir
  severity?: KpiSeverity
  style?: CSSProperties
}

export function KpiCard({ label, value, unit, delta, deltaDir, severity = 'default', style }: Props) {
  return (
    <div
      className="bg-[var(--dash-card-bg)] border border-[var(--color-gray-dark-700)] rounded-[10px] px-[18px] pt-4 pb-[14px] animate-fadeIn"
      data-severity={severity !== 'default' ? severity : undefined}
      style={style}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-gray-dark-500)] mb-[10px]">
        {label}
      </div>
      <div className={cn(
        'title-2 leading-none flex items-baseline gap-1.5 mb-2',
        severity === 'warn' && 'text-[var(--color-yellow-400)]',
        severity === 'crit' && 'text-[var(--color-red-500)]',
      )}>
        {value}
        {unit && (
          <span className="text-[12px] font-medium text-[var(--color-gray-dark-500)]" style={{ fontFamily: 'var(--font-family-body)' }}>
            {unit}
          </span>
        )}
      </div>
      <span
        data-direction={deltaDir}
        className={cn(
          'text-[11px] font-mono inline-flex items-center gap-1',
          deltaDir === 'up'   && 'text-[var(--color-green-500)]',
          deltaDir === 'down' && 'text-[var(--color-red-500)]',
          deltaDir === 'flat' && 'text-[var(--color-gray-dark-500)]',
        )}
      >
        {delta}
      </span>
    </div>
  )
}
