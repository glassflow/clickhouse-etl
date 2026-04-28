'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/src/components/ui/button'

interface SavedConnection {
  id: string
  name: string
  config: Record<string, unknown>
}

interface UseSavedConnectionChipsProps {
  connectionType: 'kafka' | 'clickhouse'
  onSelect: (config: Record<string, unknown>) => void
}

export function UseSavedConnectionChips({ connectionType, onSelect }: UseSavedConnectionChipsProps) {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const endpoint = connectionType === 'kafka'
      ? '/ui-api/library/connections/kafka'
      : '/ui-api/library/connections/clickhouse'

    fetch(endpoint)
      .then((res) => res.ok ? res.json() : [])
      .then((data: SavedConnection[]) => setConnections(Array.isArray(data) ? data : []))
      .catch(() => setConnections([]))
      .finally(() => setLoading(false))
  }, [connectionType])

  if (loading || connections.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <span className="caption-1 text-[var(--text-secondary)] shrink-0">Saved connections:</span>
      {connections.map((conn) => (
        <Button
          key={conn.id}
          variant="outline"
          size="sm"
          onClick={() => onSelect(conn.config)}
        >
          {conn.name}
        </Button>
      ))}
    </div>
  )
}
