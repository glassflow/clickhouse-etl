'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'

interface OtlpSourceNodeData extends Record<string, unknown> {
  label: string
  disabled?: boolean
  endpoint?: string
  protocol?: 'grpc' | 'http'
}

export function OtlpSourceNode({ data, selected }: NodeProps) {
  const nodeData = data as OtlpSourceNodeData
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
        <Badge variant="secondary">OTLP</Badge>
      </div>
      {nodeData.endpoint && (
        <span className="caption-1 text-[var(--text-secondary)] truncate">{nodeData.endpoint}</span>
      )}
      {nodeData.protocol && (
        <Badge variant="outline" className="self-start">
          {nodeData.protocol.toUpperCase()}
        </Badge>
      )}
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}
