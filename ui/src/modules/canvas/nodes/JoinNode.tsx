'use client'

import * as React from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitMergeIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { useStore } from '@/src/store'
import { ValidationBadge } from '../ValidationBadge'
import { LibraryChip } from '../LibraryChip'

interface JoinNodeData extends Record<string, unknown> {
  label?: string
  disabled?: boolean
  joinKey?: string
  timeWindow?: string
}

interface JoinCfg {
  transformRefId?: string
  transformLabel?: string
  pinnedVersion?: string
  hasDrift?: boolean
}

export function JoinNode({ id, data, selected }: NodeProps) {
  const { canvasStore } = useStore()
  const nodeData = data as JoinNodeData
  const cfg = (canvasStore.nodeConfigs[id] ?? {}) as JoinCfg
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
          <GitMergeIcon
            size={14}
            className="text-[var(--obs-chart-ingestor)]"
            aria-hidden="true"
          />
          <span className="body-3 text-[var(--text-primary)]">
            {nodeData.label ?? 'Join'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ValidationBadge messages={messages} />
          {nodeData.disabled ? (
            <Badge variant="secondary">Disabled</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {cfg.transformRefId && (
          <LibraryChip
            kind="transform"
            label={cfg.transformLabel ?? cfg.transformRefId}
            pinnedVersion={cfg.pinnedVersion}
            hasDrift={cfg.hasDrift}
          />
        )}
        {nodeData.joinKey && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            Key: {nodeData.joinKey}
          </span>
        )}
      </div>
      {/* Left-top target handle (first source) */}
      <Handle type="target" position={Position.Left} id="left-top" style={{ top: '30%' }} />
      {/* Left-bottom target handle (second source) */}
      <Handle type="target" position={Position.Left} id="left-bottom" style={{ top: '70%' }} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
