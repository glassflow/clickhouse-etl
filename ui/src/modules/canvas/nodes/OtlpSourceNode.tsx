'use client'

import * as React from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { WaypointsIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { useStore } from '@/src/store'
import { ValidationBadge } from '../ValidationBadge'

interface OtlpSourceNodeData extends Record<string, unknown> {
  label?: string
  disabled?: boolean
  endpoint?: string
  protocol?: 'grpc' | 'http'
}

export function OtlpSourceNode({ id, data, selected }: NodeProps) {
  const { canvasStore } = useStore()
  const nodeData = data as OtlpSourceNodeData
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
          <WaypointsIcon
            size={14}
            className="text-[var(--obs-chart-ingestor)]"
            aria-hidden="true"
          />
          <span className="body-3 text-[var(--text-primary)]">
            {nodeData.label ?? 'OTLP source'}
          </span>
        </div>
        <ValidationBadge messages={messages} />
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {nodeData.endpoint && (
          <span className="caption-1 text-[var(--text-secondary)] truncate">
            {nodeData.endpoint}
          </span>
        )}
        {nodeData.protocol && (
          <Badge variant="outline" className="self-start">
            {nodeData.protocol.toUpperCase()}
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
