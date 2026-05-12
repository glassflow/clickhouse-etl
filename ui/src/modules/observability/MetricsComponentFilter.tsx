'use client'

import { FilterPillRow } from './FilterPillRow'
import { useUrlStateArray } from '@/src/hooks/useUrlState'

export const METRICS_COMPONENTS = ['ingestor', 'processor', 'sink'] as const
export type MetricsComponent = (typeof METRICS_COMPONENTS)[number]

const SWATCHES: Record<MetricsComponent, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

const EMPTY_COUNTS: Record<MetricsComponent, number> = {
  ingestor: 0,
  processor: 0,
  sink: 0,
}

export function MetricsComponentFilter() {
  const [selected, setSelected] = useUrlStateArray('comp', [])

  const toggle = (k: MetricsComponent) => {
    setSelected(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k])
  }

  return (
    <FilterPillRow<MetricsComponent>
      label="Component"
      options={[...METRICS_COMPONENTS]}
      counts={EMPTY_COUNTS}
      selected={selected as MetricsComponent[]}
      onToggle={toggle}
      swatchColors={SWATCHES}
    />
  )
}

/**
 * Read the current component selection without rendering the filter UI.
 * Empty selection = show all.
 */
export function useSelectedMetricsComponents(): MetricsComponent[] {
  const [selected] = useUrlStateArray('comp', [])
  return selected.length === 0 ? [...METRICS_COMPONENTS] : (selected as MetricsComponent[])
}
