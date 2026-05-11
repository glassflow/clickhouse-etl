'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/src/components/ui/button'

export interface SavedConnection {
  id: string
  name: string
  config: Record<string, unknown>
}

interface LibraryConnectionPickerProps {
  connectionType: 'kafka' | 'clickhouse'
  /** Called with the full saved connection object, including id, name, and config. */
  onSelect: (connection: SavedConnection) => void
  /** Currently linked connection ref id — highlights the matching chip. */
  activeRefId?: string
}

export function LibraryConnectionPicker({
  connectionType,
  onSelect,
  activeRefId,
}: LibraryConnectionPickerProps) {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const endpoint =
      connectionType === 'kafka'
        ? '/ui-api/library/connections/kafka'
        : '/ui-api/library/connections/clickhouse'

    fetch(endpoint)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SavedConnection[]) =>
        setConnections(Array.isArray(data) ? data : []),
      )
      .catch(() => setConnections([]))
      .finally(() => setLoading(false))
  }, [connectionType])

  if (loading || connections.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="caption-1 text-[var(--text-secondary)] shrink-0">Saved:</span>
      {connections.map((conn) => (
        <Button
          key={conn.id}
          variant={activeRefId === conn.id ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onSelect(conn)}
          className="h-6 px-2 caption-1"
        >
          {conn.name}
        </Button>
      ))}
    </div>
  )
}
