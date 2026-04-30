'use client'

import { cn } from '@/src/utils/common.client'

type RetentionBarProps = {
  label: string
  retention: string // e.g. "7d"
  diskUsageBytes: number | null
  diskQuotaBytes: number | null
}

/**
 * Single retention progress bar for vmsingle / VictoriaLogs disk usage.
 *
 * Colour transitions across the `--obs-retention-{ok,warn,critical}` tokens
 * at 50% / 80% utilisation. When usage or quota is unknown, the bar collapses
 * to 0% with a neutral tone and the numeric column shows em-dashes.
 */
export function RetentionBar({
  label,
  retention,
  diskUsageBytes,
  diskQuotaBytes,
}: RetentionBarProps) {
  const pct =
    diskUsageBytes != null && diskQuotaBytes != null && diskQuotaBytes > 0
      ? Math.min(100, (diskUsageBytes / diskQuotaBytes) * 100)
      : null

  const tone =
    pct == null
      ? 'bg-[var(--color-foreground-neutral-faded)]'
      : pct < 50
        ? 'bg-[var(--obs-retention-ok)]'
        : pct < 80
          ? 'bg-[var(--obs-retention-warn)]'
          : 'bg-[var(--obs-retention-critical)]'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between caption-1">
        <span className="text-[var(--text-secondary)]">
          {label}{' '}
          <span className="mono-2 text-[var(--text-tertiary)]">· {retention}</span>
        </span>
        <span className="mono-2 text-[var(--text-tertiary)]">
          {diskUsageBytes != null ? bytes(diskUsageBytes) : '—'}
          {diskQuotaBytes != null ? ` / ${bytes(diskQuotaBytes)}` : ''}
          {pct != null ? ` · ${pct.toFixed(0)}%` : ''}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-background-elevation-base)] overflow-hidden">
        <div
          className={cn('h-full transition-all', tone)}
          style={{ width: pct == null ? '0%' : `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} disk usage`}
        />
      </div>
    </div>
  )
}

function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}
