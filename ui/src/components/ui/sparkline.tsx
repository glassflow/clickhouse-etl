import * as React from 'react'

type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
  className?: string
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = 'var(--color-foreground-primary)',
  fill = 'none',
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const path = React.useMemo(() => {
    if (data.length === 0) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const stepX = data.length > 1 ? width / (data.length - 1) : 0

    return data
      .map((value, i) => {
        const x = i * stepX
        const y = height - ((value - min) / range) * height
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [data, width, height])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path
        d={path}
        stroke={stroke}
        fill={fill}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
