'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'

interface FilterNodeData extends Record<string, unknown> {
  label: string
  disabled?: boolean
  expression?: string
}

export function FilterNode({ data, selected }: NodeProps) {
  const nodeData = data as FilterNodeData
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
      {nodeData.expression && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">{nodeData.expression}</span>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}
