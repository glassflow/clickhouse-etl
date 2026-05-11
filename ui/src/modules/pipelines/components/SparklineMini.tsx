'use client'

interface SparklineMiniProps {
  data: number[]
  width?: number
  height?: number
  color?: string
}

export function SparklineMini({ data, width = 56, height = 16, color = 'currentColor' }: SparklineMiniProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 1.5

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - pad - ((v - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}
