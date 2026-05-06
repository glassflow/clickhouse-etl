'use client'

export type KpiSeverity = 'default' | 'warn' | 'crit'
export type DeltaDir = 'up' | 'down' | 'flat'

type SparkProps = { data: number[]; color?: string }

function Spark({ data, color = 'var(--color-gray-dark-100)' }: SparkProps) {
  if (data.length < 2) return null
  const w = 64,
    h = 24
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="dash-kpi-spark" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  label: string
  value: string
  unit?: string
  delta: string
  deltaDir: DeltaDir
  severity?: KpiSeverity
  sparkData: number[]
  sparkColor?: string
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaDir,
  severity = 'default',
  sparkData,
  sparkColor,
}: Props) {
  const cls = `dash-kpi${severity === 'warn' ? ' is-warn' : severity === 'crit' ? ' is-crit' : ''}`
  return (
    <div className={cls}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <span className={`delta ${deltaDir}`}>{delta}</span>
      <Spark data={sparkData} color={sparkColor} />
    </div>
  )
}
