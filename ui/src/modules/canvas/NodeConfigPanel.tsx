'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'

interface NodeConfigPanelProps {
  nodeId: string
  onClose: () => void
}

const NODE_LABELS: Record<string, string> = {
  source: 'Source',
  dedup: 'Deduplication',
  filter: 'Filter',
  transform: 'Transform',
  sink: 'ClickHouse Sink',
}

export function NodeConfigPanel({ nodeId, onClose }: NodeConfigPanelProps) {
  const { canvasStore } = useStore()
  const config = canvasStore.nodeConfigs[nodeId] ?? {}
  const nodeName = NODE_LABELS[nodeId] ?? nodeId

  const entries = Object.entries(config).filter(([, v]) => v !== undefined && v !== null && v !== '')

  return (
    <Card variant="dark" className="w-80 p-4 flex flex-col gap-3 shrink-0 animate-slideDown">
      <div className="flex items-center justify-between">
        <h3 className="title-5 text-[var(--text-primary)]">{nodeName}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="caption-1 text-[var(--text-secondary)]">{key}</span>
              <span className="body-3 text-[var(--text-primary)] truncate">{String(value)}</span>
            </div>
          ))}
        </div>
      ) : (
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
