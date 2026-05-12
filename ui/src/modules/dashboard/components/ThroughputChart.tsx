'use client'

import { cn } from '@/src/utils/common.client'
import type { DashStats } from '../types'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

type ChartProps = { inSeries: number[]; outSeries: number[] }

function SvgChart({ inSeries, outSeries }: ChartProps) {
  const w = 640, h = 130, pad = 8
  const all = [...inSeries, ...outSeries]
  if (all.length === 0) return null
  const N = inSeries.length
  if (N < 2) return null
  const max = Math.max(...all) * 1.1 || 1
  const stepX = (w - pad * 2) / (N - 1)
  const yFor = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const polyIn = inSeries.map((v, i) => `${pad + i * stepX},${yFor(v)}`).join(' ')
  const polyOut = outSeries.map((v, i) => `${pad + i * stepX},${yFor(v)}`).join(' ')
  const areaIn = `${pad},${h - pad} ${polyIn} ${pad + (N - 1) * stepX},${h - pad}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="thruGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-orange-300)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-orange-300)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={pad} x2={w - pad}
          y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)}
          stroke="var(--color-gray-dark-800)" strokeDasharray="2 4" />
      ))}
      <polygon points={areaIn} fill="url(#thruGrad)" />
      <polyline points={polyIn} fill="none" stroke="var(--color-orange-300)" strokeWidth="1.5" />
      <polyline points={polyOut} fill="none" stroke="var(--color-blue-500)" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  )
}

type Props = { stats: DashStats; isIncidentState: boolean }

export function ThroughputChart({ stats, isIncidentState }: Props) {
  const lossCls = stats.throughputLossPct > 10 ? 'text-[var(--color-red-500)]' : stats.throughputLossPct > 1 ? 'text-[var(--color-yellow-400)]' : ''
  const title = isIncidentState ? 'Throughput · with incident overlay' : 'Throughput'

  return (
    <div className="bg-[var(--dash-card-bg)] border border-[var(--color-gray-dark-700)] rounded-[10px] flex flex-col overflow-hidden p-[18px]">
      {/* card header — no border-bottom here per original thru-card override */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="title-6 font-semibold m-0 tracking-[-0.005em] text-[var(--color-foreground-neutral)]">
          {title}
        </h3>
        <a
          href="/observability"
          className="text-[11.5px] text-[var(--color-gray-dark-100)] font-mono no-underline hover:text-[var(--color-orange-300)] transition-colors duration-[120ms] focus-ring"
        >
          Open in observability →
        </a>
      </div>

      {/* totals row */}
      <div className="flex gap-6 mb-4">
        {[
          { lbl: 'In · last hour',  val: fmtM(stats.throughputIn),  extra: '' },
          { lbl: 'Out · last hour', val: fmtM(stats.throughputOut), extra: '' },
          { lbl: 'Loss',            val: `${stats.throughputLossPct.toFixed(2)}`, extra: lossCls, severity: stats.throughputLossPct > 10 ? 'crit' : stats.throughputLossPct > 1 ? 'warn' : undefined },
        ].map(({ lbl, val, extra, severity }) => (
          <div key={lbl}>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--color-gray-dark-500)]">{lbl}</div>
            <div data-severity={severity} className={cn('title-5 font-semibold mt-0.5', extra || 'text-[var(--color-foreground-neutral)]')}>
              {val}
              <span className="text-[11px] text-[var(--color-gray-dark-500)] ml-0.5" style={{ fontFamily: 'var(--font-family-body)', fontWeight: 500 }}>
                {lbl === 'Loss' ? '%' : 'events'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <SvgChart inSeries={stats.throughputSeries.in} outSeries={stats.throughputSeries.out} />

      <div className="flex gap-[14px] text-[10.5px] font-mono text-[var(--color-gray-dark-100)] mt-[10px]">
        <div>
          <span
            className="inline-block w-2 h-2 rounded-sm mr-1.5 align-[1px]"
            style={{ background: 'var(--color-orange-300)' }}
          />
          events in
        </div>
        <div>
          <span
            className="inline-block w-2 h-2 rounded-sm mr-1.5 align-[1px]"
            style={{ background: 'var(--color-blue-500)' }}
          />
          events written to ClickHouse
        </div>
      </div>
    </div>
  )
}
