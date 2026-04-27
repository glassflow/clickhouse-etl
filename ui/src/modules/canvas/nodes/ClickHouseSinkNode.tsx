'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'

interface ClickHouseSinkNodeData extends Record<string, unknown> {
  label: string
  disabled?: boolean
  host?: string
  table?: string
}

export function ClickHouseSinkNode({ data, selected }: NodeProps) {
  const nodeData = data as ClickHouseSinkNodeData
  return (
    <Card
      variant="dark"
      className={[
        'min-w-[160px] p-3 flex flex-col gap-1.5 cursor-pointer',
        nodeData.disabled ? 'opacity-40 pointer-events-none' : '',
        selected ? 'ring-2 ring-[var(--color-brand-primary)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="title-6 text-[var(--text-primary)]">{nodeData.label}</span>
        <Badge variant="secondary">Sink</Badge>
      </div>
      {nodeData.host && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">{nodeData.host}</span>
      )}
      {nodeData.table && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">Table: {nodeData.table}</span>
      )}
      <Handle type="target" position={Position.Left} />
    </Card>
  )
}
