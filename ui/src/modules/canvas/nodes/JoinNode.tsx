'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'

interface JoinNodeData extends Record<string, unknown> {
  label: string
  disabled?: boolean
  joinKey?: string
  timeWindow?: string
}

export function JoinNode({ data, selected }: NodeProps) {
  const nodeData = data as JoinNodeData
  return (
    <Card
      variant="dark"
      className={[
        'min-w-[160px] p-3 flex flex-col gap-1.5 cursor-pointer',
        nodeData.disabled ? 'opacity-40 pointer-events-none' : '',
        selected ? 'card-dark-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="title-6 text-[var(--text-primary)]">{nodeData.label}</span>
        {nodeData.disabled ? (
          <Badge variant="secondary">Disabled</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        )}
      </div>
      {nodeData.joinKey && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">Key: {nodeData.joinKey}</span>
      )}
      {/* Left-top target handle (first source) */}
      <Handle type="target" position={Position.Left} id="left-top" style={{ top: '30%' }} />
      {/* Left-bottom target handle (second source) */}
      <Handle type="target" position={Position.Left} id="left-bottom" style={{ top: '70%' }} />
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}
