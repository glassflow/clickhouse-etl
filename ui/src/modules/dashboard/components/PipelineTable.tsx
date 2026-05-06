'use client'

import { useState } from 'react'
import { SquareIcon, BarChartIcon, MoreHorizontalIcon } from 'lucide-react'
import type { DashPipeline, DashPipelineStatus } from '../types'

type FilterKey = 'all' | DashPipelineStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'run',    label: 'Running' },
  { key: 'deg',    label: 'Degraded' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft',  label: 'Drafts' },
]

function StatusChip({ kind, label }: { kind: DashPipelineStatus; label: string }) {
  return (
    <span className={`status-chip ${kind}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  )
}

type RowProps = { pipeline: DashPipeline }

function PipelineRow({ pipeline: p }: RowProps) {
  return (
    <tr>
      <td>
        <div className="pipe-name">
          {p.name}
          <span className="pipe-ver">{p.version}</span>
        </div>
      </td>
      <td>
        <div className="pipe-route">
          {p.sourceTopic}
          <span className="pipe-arrow">→</span>
          {p.destTable}
        </div>
      </td>
      <td><StatusChip kind={p.status} label={p.statusLabel} /></td>
      <td className="r">
        <div className="metric-cell">{p.throughput}<span className="u">{p.throughputUnit}</span></div>
      </td>
      <td className="r">
        <div className={`metric-cell${p.lagSeverity ? ` ${p.lagSeverity}` : ''}`}>
          {p.lagP95}<span className="u">{p.lagUnit}</span>
        </div>
      </td>
      <td className="r">
        <div className={`metric-cell${p.dlqSeverity ? ` ${p.dlqSeverity}` : ''}`}>{p.dlq || '0'}</div>
      </td>
      <td>
        <div className="metric-cell" style={{ fontSize: 11.5 }}>
          {p.lastDeploy}
          <span className="sub">by {p.deployedBy}</span>
        </div>
      </td>
      <td className="r">
        <div className="row-actions">
          <button title="Open canvas" type="button"><SquareIcon size={13} /></button>
          <button title="Metrics" type="button"><BarChartIcon size={13} /></button>
          <button title="More" type="button"><MoreHorizontalIcon size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

type Props = { pipelines: DashPipeline[] }

export function PipelineTable({ pipelines }: Props) {
  const [active, setActive] = useState<FilterKey>('all')

  const counts: Record<FilterKey, number> = {
    all:    pipelines.length,
    run:    pipelines.filter((p) => p.status === 'run').length,
    deg:    pipelines.filter((p) => p.status === 'deg').length,
    paused: pipelines.filter((p) => p.status === 'paused').length,
    draft:  pipelines.filter((p) => p.status === 'draft').length,
    fail:   pipelines.filter((p) => p.status === 'fail').length,
  }

  const visible = active === 'all' ? pipelines : pipelines.filter((p) => p.status === active)

  return (
    <div className="dash-table">
      <div className="dash-table-h">
        <h3>Pipelines</h3>
        <div className="dash-filters">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`dash-filter-chip${active === key ? ' is-active' : ''}`}
              onClick={() => setActive(key)}
            >
              {label}
              <span className="dash-filter-n">{counts[key]}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="dash-filter-chip" type="button">Sort: throughput ▾</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Pipeline</th>
            <th>Source → destination</th>
            <th>Status</th>
            <th className="r">Throughput</th>
            <th className="r">Lag · p95</th>
            <th className="r">DLQ</th>
            <th>Last deploy</th>
            <th className="r" />
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => <PipelineRow key={p.id} pipeline={p} />)}
        </tbody>
      </table>
    </div>
  )
}
