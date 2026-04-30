'use client'

import * as React from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { RadioIcon } from 'lucide-react'
import { useStore } from '@/src/store'
import { ValidationBadge } from '../ValidationBadge'
import { LibraryChip } from '../LibraryChip'

interface KafkaSourceNodeData extends Record<string, unknown> {
  label?: string
  disabled?: boolean
  bootstrapServers?: string
  topicName?: string
}

interface KafkaSourceCfg {
  connectionRefId?: string
  connectionLabel?: string
  topics?: Array<{
    schemaRefId?: string
    schemaLabel?: string
    pinnedVersion?: string
    hasDrift?: boolean
  }>
}

export function KafkaSourceNode({ id, data, selected }: NodeProps) {
  const { canvasStore } = useStore()
  const nodeData = data as KafkaSourceNodeData
  const cfg = (canvasStore.nodeConfigs[id] ?? {}) as KafkaSourceCfg
  const messages = React.useMemo(
    () => canvasStore.validate().byNode[id] ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasStore.nodes, canvasStore.edges, canvasStore.nodeConfigs, id],
  )

  const connectionRefId = cfg.connectionRefId
  const connectionLabel = cfg.connectionLabel
  const topics = cfg.topics ?? []

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
          <RadioIcon
            size={14}
            className="text-[var(--obs-chart-ingestor)]"
            aria-hidden="true"
          />
          <span className="body-3 text-[var(--text-primary)]">
            {nodeData.label ?? 'Kafka source'}
          </span>
        </div>
        <ValidationBadge messages={messages} />
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {connectionRefId && (
          <LibraryChip
            kind="connection"
            label={connectionLabel ?? connectionRefId}
          />
        )}
        {topics.map((t, i) =>
          t.schemaRefId ? (
            <LibraryChip
              key={i}
              kind="schema"
              label={t.schemaLabel ?? t.schemaRefId}
              pinnedVersion={t.pinnedVersion}
              hasDrift={t.hasDrift}
            />
          ) : null,
        )}
        {!connectionRefId && nodeData.bootstrapServers && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            {nodeData.bootstrapServers}
          </span>
        )}
        {!connectionRefId && nodeData.topicName && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            {nodeData.topicName}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
