'use client'

import * as React from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DatabaseIcon } from 'lucide-react'
import { useStore } from '@/src/store'
import { ValidationBadge } from '../ValidationBadge'
import { LibraryChip } from '../LibraryChip'

interface ClickHouseSinkNodeData extends Record<string, unknown> {
  label?: string
  disabled?: boolean
  host?: string
  table?: string
}

interface ClickHouseSinkCfg {
  connectionRefId?: string
  connectionLabel?: string
  schemaRefId?: string
  schemaLabel?: string
  pinnedSchemaVersion?: string
  hasDrift?: boolean
}

export function ClickHouseSinkNode({ id, data, selected }: NodeProps) {
  const { canvasStore } = useStore()
  const nodeData = data as ClickHouseSinkNodeData
  const cfg = (canvasStore.nodeConfigs[id] ?? {}) as ClickHouseSinkCfg
  const messages = React.useMemo(
    () => canvasStore.validate().byNode[id] ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasStore.nodes, canvasStore.edges, canvasStore.nodeConfigs, id],
  )

  return (
    <div
      className={[
        'min-w-[220px] rounded-lg border bg-[var(--color-background-elevation-raised)] shadow-sm',
        nodeData.disabled ? 'opacity-40 pointer-events-none' : '',
        selected
          ? 'border-[var(--color-foreground-primary)]'
          : 'border-[var(--surface-border)]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <DatabaseIcon
            size={14}
            className="text-[var(--obs-chart-ingestor)]"
            aria-hidden="true"
          />
          <span className="body-3 text-[var(--text-primary)]">
            {nodeData.label ?? 'ClickHouse sink'}
          </span>
        </div>
        <ValidationBadge messages={messages} />
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {cfg.connectionRefId && (
          <LibraryChip
            kind="connection"
            label={cfg.connectionLabel ?? cfg.connectionRefId}
          />
        )}
        {cfg.schemaRefId && (
          <LibraryChip
            kind="schema"
            label={cfg.schemaLabel ?? cfg.schemaRefId}
            pinnedVersion={cfg.pinnedSchemaVersion}
            hasDrift={cfg.hasDrift}
          />
        )}
        {!cfg.connectionRefId && nodeData.host && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            {nodeData.host}
          </span>
        )}
        {!cfg.connectionRefId && nodeData.table && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            Table: {nodeData.table}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}
