'use client'

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
  const max = Math.max(...all) * 1.1 || 1
  const N = inSeries.length
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
  const lossCls = stats.throughputLossPct > 10 ? 'loss-crit' : stats.throughputLossPct > 1 ? 'loss-warn' : ''
  const title = isIncidentState ? 'Throughput · with incident overlay' : 'Throughput'
  return (
    <div className="dash-card thru-card">
      <div className="dash-card-h" style={{ padding: 0, marginBottom: 12, borderBottom: 'none' }}>
        <h3>{title}</h3>
        <a href="/observability" className="dash-link">Open in observability →</a>
      </div>
      <div className="thru-totals">
        <div className="thru-blk">
          <div className="thru-lbl">In · last hour</div>
          <div className="thru-val">{fmtM(stats.throughputIn)}<span className="thru-unit">events</span></div>
        </div>
        <div className="thru-blk">
          <div className="thru-lbl">Out · last hour</div>
          <div className="thru-val">{fmtM(stats.throughputOut)}<span className="thru-unit">events</span></div>
        </div>
        <div className="thru-blk">
          <div className="thru-lbl">Loss</div>
          <div className={`thru-val ${lossCls}`}>{stats.throughputLossPct.toFixed(2)}<span className="thru-unit">%</span></div>
        </div>
      </div>
      <SvgChart inSeries={stats.throughputSeries.in} outSeries={stats.throughputSeries.out} />
      <div className="thru-legend">
        <div><span className="thru-swatch" style={{ background: 'var(--color-orange-300)' }} />events in</div>
        <div><span className="thru-swatch" style={{ background: 'var(--color-blue-500)' }} />events written to ClickHouse</div>
      </div>
    </div>
  )
}
