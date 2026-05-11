'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { LibraryConnectionPicker } from '@/src/components/common/LibraryConnectionPicker'
import type { SavedConnection } from '@/src/components/common/LibraryConnectionPicker'

interface NodeConfigPanelProps {
  nodeId: string
  onClose: () => void
}

const NODE_LABELS: Record<string, string> = {
  kafkaSource: 'Kafka Source',
  otlpSource: 'OTLP Source',
  dedup: 'Deduplication',
  filter: 'Filter',
  transform: 'Transform',
  join: 'Join',
  clickhouseSink: 'ClickHouse Sink',
  // legacy keys
  source: 'Source',
  sink: 'ClickHouse Sink',
}

export function NodeConfigPanel({ nodeId, onClose }: NodeConfigPanelProps) {
  const { canvasStore } = useStore()
  const config = canvasStore.nodeConfigs[nodeId] ?? {}
  const nodeType = canvasStore.nodes.find((n) => n.id === nodeId)?.type ?? ''
  const nodeName = NODE_LABELS[nodeType] ?? NODE_LABELS[nodeId] ?? nodeId

  const entries = Object.entries(config).filter(
    ([k, v]) =>
      v !== undefined && v !== null && v !== '' && k !== 'connectionRefId' && k !== 'connectionLabel',
  )

  const connectionRefId = config.connectionRefId as string | undefined

  const handleConnectionSelect = (conn: SavedConnection) => {
    canvasStore.setNodeConfig(nodeId, {
      ...config,
      connectionRefId: conn.id,
      connectionLabel: conn.name,
    })
  }

  const pickerType =
    nodeType === 'kafkaSource' ? 'kafka' : nodeType === 'clickhouseSink' ? 'clickhouse' : null

  return (
    <Card variant="dark" className="w-80 p-4 flex flex-col gap-3 shrink-0 animate-slideDown">
      <div className="flex items-center justify-between">
        <h3 className="title-5 text-[var(--text-primary)]">{nodeName}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {pickerType && (
        <div className="flex flex-col gap-1.5">
          <span className="caption-2 text-[var(--text-tertiary)] uppercase tracking-wide">
            Library connection
          </span>
          <LibraryConnectionPicker
            connectionType={pickerType}
            onSelect={handleConnectionSelect}
            activeRefId={connectionRefId}
          />
          {!connectionRefId && (
            <p className="caption-1 text-[var(--text-tertiary)]">No saved connection linked.</p>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="caption-1 text-[var(--text-secondary)]">{key}</span>
              <span className="body-3 text-[var(--text-primary)] truncate">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !pickerType && (
        <p className="body-3 text-[var(--text-secondary)]">No configuration set for this node.</p>
      )}

      <Link href="/pipelines/create" className="mt-auto">
        <Button variant="outline" size="sm" className="w-full">
          Edit in Wizard
        </Button>
      </Link>
    </Card>
  )
}
