'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'

interface KafkaSourceNodeData extends Record<string, unknown> {
  label: string
  disabled?: boolean
  bootstrapServers?: string
  topicName?: string
}

export function KafkaSourceNode({ data, selected }: NodeProps) {
  const nodeData = data as KafkaSourceNodeData
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
        <Badge variant="secondary">Source</Badge>
      </div>
      {nodeData.bootstrapServers && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">{nodeData.bootstrapServers}</span>
      )}
      {nodeData.topicName && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">{nodeData.topicName}</span>
      )}
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}
