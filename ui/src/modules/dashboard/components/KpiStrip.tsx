'use client'

import { KpiCard } from './KpiCard'
import type { DashStats } from '../types'

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtDelta(d: number, decimals = 1): string {
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(decimals)}%`
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}` : String(ms)
}

function msUnit(ms: number): string {
  return ms >= 1000 ? 's · p95' : 'ms · p95'
}

type Props = { stats: DashStats }

const DELAYS = [0, 40, 80, 120, 160]

export function KpiStrip({ stats }: Props) {
  const errorSeverity = stats.errorRate > 1 ? 'crit' : stats.errorRate > 0.1 ? 'warn' : 'default'
  const dlqSeverity = stats.dlqEvents > 1000 ? 'crit' : stats.dlqEvents > 100 ? 'warn' : 'default'
  const evDelta = stats.eventsPerSecDelta
  const errDelta = stats.errorRateDelta
  const dlqDelta = stats.dlqDelta
  const lagDelta = stats.avgLagMsDelta

  return (
    <div className="grid grid-cols-5 gap-3 px-10 py-6 border-b border-[var(--color-gray-dark-800)] shrink-0">
      <KpiCard
        label="Active pipelines"
        value={String(stats.activePipelines)}
        unit={`/ ${stats.totalPipelines}`}
        delta="no change · 1h"
        deltaDir="flat"
        style={{ animationDelay: `${DELAYS[0]}ms` }}
      />
      <KpiCard
        label="Events / sec"
        value={fmtNumber(stats.eventsPerSec)}
        unit="in"
        delta={fmtDelta(evDelta)}
        deltaDir={evDelta > 0 ? 'up' : evDelta < 0 ? 'down' : 'flat'}
        style={{ animationDelay: `${DELAYS[1]}ms` }}
      />
      <KpiCard
        label="Error rate"
        value={stats.errorRate.toFixed(2)}
        unit="%"
        delta={fmtDelta(errDelta)}
        deltaDir={errDelta > 0 ? 'down' : errDelta < 0 ? 'up' : 'flat'}
        severity={errorSeverity}
        style={{ animationDelay: `${DELAYS[2]}ms` }}
      />
      <KpiCard
        label="DLQ events"
        value={stats.dlqEvents.toLocaleString()}
        delta={dlqDelta > 0 ? `+${dlqDelta.toLocaleString()} · 1h` : 'stable'}
        deltaDir={dlqDelta > 0 ? 'down' : 'flat'}
        severity={dlqSeverity}
        style={{ animationDelay: `${DELAYS[3]}ms` }}
      />
      <KpiCard
        label="Avg lag"
        value={fmtMs(stats.avgLagMs)}
        unit={msUnit(stats.avgLagMs)}
        delta={lagDelta === 0 ? 'stable' : fmtDelta(lagDelta / 1000)}
        deltaDir={lagDelta > 0 ? 'down' : lagDelta < 0 ? 'up' : 'flat'}
        style={{ animationDelay: `${DELAYS[4]}ms` }}
      />
    </div>
  )
}
