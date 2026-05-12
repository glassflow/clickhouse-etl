'use client'

import * as React from 'react'

export type OBSeries = {
  id: string
  color: string
  points: Array<[ms: number, v: number]>
  dashed?: boolean
  fill?: string
}

export type OBChartSVGProps = {
  series: OBSeries[]
  yMax?: number
  yMin?: number
  width?: number
  height?: number
  pad?: { l: number; r: number; t: number; b: number }
  showCrosshair?: boolean
  showBrush?: boolean
  brushFromMs?: number | null
  brushToMs?: number | null
  onBrushChange?: (fromMs: number, toMs: number) => void
  onBrushClear?: () => void
}

const DEFAULT_PAD = { l: 36, r: 8, t: 8, b: 22 }

export function OBChartSVG({
  series,
  yMax,
  yMin,
  width = 800,
  height = 320,
  pad = DEFAULT_PAD,
  showCrosshair = false,
  showBrush = false,
  brushFromMs = null,
  brushToMs = null,
  onBrushChange,
  onBrushClear,
}: OBChartSVGProps) {
  const [hoverX, setHoverX] = React.useState<number | null>(null)
  const [dragStartMs, setDragStartMs] = React.useState<number | null>(null)
  const [dragCurrentMs, setDragCurrentMs] = React.useState<number | null>(null)

  // Cancel an in-flight drag if the user releases outside the SVG.
  // SVG mouseUp doesn't fire when the pointer leaves the element, so without
  // this the brush state stays stuck and a phantom rectangle lingers.
  React.useEffect(() => {
    if (dragStartMs == null) return
    const cancel = () => {
      setDragStartMs(null)
      setDragCurrentMs(null)
    }
    window.addEventListener('mouseup', cancel)
    return () => window.removeEventListener('mouseup', cancel)
  }, [dragStartMs])

  const allTs: number[] = []
  const allVs: number[] = []
  for (const s of series) {
    for (const [t, v] of s.points) {
      allTs.push(t)
      if (Number.isFinite(v)) allVs.push(v)
    }
  }

  if (allTs.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Time series chart"
        style={{ display: 'block' }}
      />
    )
  }

  const tMin = Math.min(...allTs)
  const tMax = Math.max(...allTs)
  const vMin = yMin ?? Math.min(...allVs)
  const vMax = yMax ?? Math.max(...allVs)
  const vRange = vMax - vMin || 1

  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  const tRange = tMax - tMin || 1
  const xScale = (t: number) => pad.l + ((t - tMin) / tRange) * plotW
  const yScale = (v: number) => pad.t + plotH - ((v - vMin) / vRange) * plotH
  const xToMs = (x: number) => tMin + ((x - pad.l) / plotW) * tRange
  const clampX = (x: number) => Math.min(pad.l + plotW, Math.max(pad.l, x))

  const yTicks: number[] = []
  for (let i = 0; i <= 4; i++) yTicks.push(vMin + (vRange * i) / 4)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (showCrosshair) {
      setHoverX(x < pad.l || x > pad.l + plotW ? null : x)
    }
    if (showBrush && dragStartMs != null) {
      setDragCurrentMs(xToMs(clampX(x)))
    }
  }

  const handleMouseLeave = () => setHoverX(null)

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!showBrush) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < pad.l || x > pad.l + plotW) return
    setDragStartMs(xToMs(x))
    setDragCurrentMs(xToMs(x))
  }

  const handleMouseUp = () => {
    if (!showBrush) return
    if (dragStartMs != null && dragCurrentMs != null && dragStartMs !== dragCurrentMs) {
      const fromMs = Math.min(dragStartMs, dragCurrentMs)
      const toMs = Math.max(dragStartMs, dragCurrentMs)
      onBrushChange?.(fromMs, toMs)
    }
    setDragStartMs(null)
    setDragCurrentMs(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!showBrush || brushFromMs == null || brushToMs == null) return
    const step = (brushToMs - brushFromMs) * 0.05
    if (e.key === 'ArrowRight') {
      onBrushChange?.(brushFromMs + step, brushToMs + step)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      onBrushChange?.(brushFromMs - step, brushToMs - step)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      onBrushClear?.()
      e.preventDefault()
    }
  }

  const activeFrom = dragStartMs != null && dragCurrentMs != null ? Math.min(dragStartMs, dragCurrentMs) : brushFromMs
  const activeTo = dragStartMs != null && dragCurrentMs != null ? Math.max(dragStartMs, dragCurrentMs) : brushToMs

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      tabIndex={showBrush ? 0 : -1}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      style={{ display: 'block', outline: 'none' }}
      role="img"
      aria-label="Time series chart"
    >
      {yTicks.map((v, i) => {
        const y = yScale(v)
        return (
          <g key={`yt-${i}`}>
            <line
              x1={pad.l}
              x2={pad.l + plotW}
              y1={y}
              y2={y}
              stroke="var(--obs-chart-grid)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              data-axis="y"
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--obs-chart-axis)"
              fontFamily="var(--font-family-mono)"
              fontSize={10}
            >
              {formatYTick(v)}
            </text>
          </g>
        )
      })}

      <line
        x1={pad.l}
        x2={pad.l + plotW}
        y1={pad.t + plotH}
        y2={pad.t + plotH}
        stroke="var(--obs-chart-axis)"
        strokeWidth={1}
      />

      {activeFrom != null && activeTo != null && (
        <rect
          data-brush-region=""
          x={xScale(activeFrom)}
          y={pad.t}
          width={Math.max(1, xScale(activeTo) - xScale(activeFrom))}
          height={plotH}
          fill="var(--color-foreground-primary)"
          fillOpacity={0.13}
          stroke="var(--color-foreground-primary)"
          strokeOpacity={0.6}
          strokeWidth={1}
        />
      )}

      {series.map((s) => (
        <path
          key={s.id}
          data-series-id={s.id}
          d={pathFromPoints(s.points, xScale, yScale)}
          stroke={s.color}
          strokeWidth={1.5}
          strokeDasharray={s.dashed ? '4 3' : undefined}
          fill="none"
        />
      ))}

      {hoverX != null && (
        <line
          data-crosshair=""
          x1={hoverX}
          x2={hoverX}
          y1={pad.t}
          y2={pad.t + plotH}
          stroke="var(--color-foreground-primary)"
          strokeDasharray="3 3"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
    </svg>
  )
}

function pathFromPoints(
  points: Array<[number, number]>,
  xScale: (t: number) => number,
  yScale: (v: number) => number,
): string {
  const segments: string[] = []
  let needMoveTo = true
  for (const [t, v] of points) {
    if (!Number.isFinite(v)) {
      // Gap in the series — next finite point starts a new subpath.
      needMoveTo = true
      continue
    }
    segments.push(`${needMoveTo ? 'M' : 'L'} ${xScale(t).toFixed(2)} ${yScale(v).toFixed(2)}`)
    needMoveTo = false
  }
  return segments.join(' ')
}

function formatYTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  if (v < 1 && v > 0) return v.toFixed(2)
  return Math.round(v).toString()
}
