'use client'

export type KpiSeverity = 'default' | 'warn' | 'crit'
export type DeltaDir = 'up' | 'down' | 'flat'

type Props = {
  label: string
  value: string
  unit?: string
  delta: string
  deltaDir: DeltaDir
  severity?: KpiSeverity
}

export function KpiCard({ label, value, unit, delta, deltaDir, severity = 'default' }: Props) {
  const cls = `dash-kpi${severity === 'warn' ? ' is-warn' : severity === 'crit' ? ' is-crit' : ''}`
  return (
    <div className={cls}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <span className={`delta ${deltaDir}`}>{delta}</span>
    </div>
  )
}
