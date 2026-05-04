import { cn } from '@/src/utils/common.client'
import {
  WorkflowIcon,
  DatabaseIcon,
  LayoutListIcon,
  CopyIcon,
  FilterIcon,
  ArrowLeftRightIcon,
} from 'lucide-react'
import type React from 'react'

export type LibraryResourceType = 'kafka' | 'clickhouse' | 'schema' | 'dedup' | 'filter' | 'transform'

const ICONS: Record<LibraryResourceType, React.ElementType> = {
  kafka:      WorkflowIcon,
  clickhouse: DatabaseIcon,
  schema:     LayoutListIcon,
  dedup:      CopyIcon,
  filter:     FilterIcon,
  transform:  ArrowLeftRightIcon,
}

const GLYPH_STYLES: Record<LibraryResourceType, { color: string; bg: string; border: string }> = {
  kafka:      { color: 'var(--glyph-kafka-color)',     bg: 'var(--glyph-kafka-bg)',     border: 'var(--glyph-kafka-border)' },
  clickhouse: { color: 'var(--glyph-ch-color)',        bg: 'var(--glyph-ch-bg)',        border: 'var(--glyph-ch-border)' },
  schema:     { color: 'var(--glyph-schema-color)',    bg: 'var(--glyph-schema-bg)',    border: 'var(--glyph-schema-border)' },
  dedup:      { color: 'var(--glyph-dedup-color)',     bg: 'var(--glyph-dedup-bg)',     border: 'var(--glyph-dedup-border)' },
  filter:     { color: 'var(--glyph-filter-color)',    bg: 'var(--glyph-filter-bg)',    border: 'var(--glyph-filter-border)' },
  transform:  { color: 'var(--glyph-transform-color)', bg: 'var(--glyph-transform-bg)', border: 'var(--glyph-transform-border)' },
}

type Props = {
  type: LibraryResourceType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LibraryTypeGlyph({ type, size = 'md', className }: Props) {
  const Icon = ICONS[type]
  const { color, bg, border } = GLYPH_STYLES[type]
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14
  const wh = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-9 h-9' : 'w-7 h-7'

  return (
    <span
      className={cn('inline-grid place-items-center rounded-[6px] border shrink-0', wh, className)}
      style={{ color, backgroundColor: bg, borderColor: border }}
    >
      <Icon size={iconSize} strokeWidth={1.75} />
    </span>
  )
}
