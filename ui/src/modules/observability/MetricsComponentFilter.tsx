'use client'

import { FilterPillRow } from './FilterPillRow'
import { useUrlStateArray } from '@/src/hooks/useUrlState'

export const METRICS_COMPONENTS = ['ingestor', 'processor', 'sink'] as const
export type MetricsComponent = (typeof METRICS_COMPONENTS)[number]

const VALID = new Set<string>(METRICS_COMPONENTS)
const ALL_COMPONENTS: MetricsComponent[] = [...METRICS_COMPONENTS]

const SWATCHES: Record<MetricsComponent, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

function sanitize(values: string[]): MetricsComponent[] {
  return values.filter((v): v is MetricsComponent => VALID.has(v))
}

export function MetricsComponentFilter() {
  const [raw, setSelected] = useUrlStateArray('comp', [])
  const selected = sanitize(raw)

  const toggle = (k: MetricsComponent) => {
    setSelected(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k])
  }

  return (
    <FilterPillRow<MetricsComponent>
      label="Component"
      options={ALL_COMPONENTS}
      selected={selected}
      onToggle={toggle}
      swatchColors={SWATCHES}
    />
  )
}

/**
 * Read the current component selection without rendering the filter UI.
 * Empty / invalid selection = show all.
 */
export function useSelectedMetricsComponents(): MetricsComponent[] {
  const [raw] = useUrlStateArray('comp', [])
  const filtered = sanitize(raw)
  return filtered.length === 0 ? ALL_COMPONENTS : filtered
}
