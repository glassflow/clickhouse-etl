'use client'

import {
  DatabaseIcon,
  FilterIcon,
  GitMergeIcon,
  LayersIcon,
  RadioIcon,
  WandIcon,
  WaypointsIcon,
} from 'lucide-react'
import { PaletteItem } from './PaletteItem'

const ITEMS = [
  {
    kind: 'kafkaSource',
    label: 'Kafka source',
    description: 'Consume from a Kafka topic',
    icon: <RadioIcon size={16} />,
  },
  {
    kind: 'otlpSource',
    label: 'OTLP source',
    description: 'OpenTelemetry logs/traces/metrics',
    icon: <WaypointsIcon size={16} />,
  },
  {
    kind: 'dedup',
    label: 'Deduplicate',
    description: 'Drop duplicate events',
    icon: <LayersIcon size={16} />,
  },
  {
    kind: 'filter',
    label: 'Filter',
    description: 'Conditional event drop',
    icon: <FilterIcon size={16} />,
  },
  {
    kind: 'transform',
    label: 'Transform',
    description: 'Reshape events with JS or SQL',
    icon: <WandIcon size={16} />,
  },
  {
    kind: 'join',
    label: 'Join',
    description: 'Merge two streams on a key',
    icon: <GitMergeIcon size={16} />,
  },
  {
    kind: 'clickhouseSink',
    label: 'ClickHouse sink',
    description: 'Write rows into ClickHouse',
    icon: <DatabaseIcon size={16} />,
  },
] as const

export function NodePalette() {
  return (
    <aside className="w-56 shrink-0 flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-background-elevation-raised-faded)] border border-[var(--surface-border)] overflow-y-auto">
      <h3 className="caption-1 uppercase tracking-wider text-[var(--text-tertiary)] px-1 pt-1">
        Nodes
      </h3>
      {ITEMS.map((item) => (
        <PaletteItem key={item.kind} {...item} />
      ))}
    </aside>
  )
}
