'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { useStore } from '@/src/store'

interface LibraryConnection {
  id: string
  name: string
  description?: string
  config: Record<string, unknown>
}

export function LibrarySidebar() {
  const { canvasStore } = useStore()
  const { activeNodeId, setNodeConfig } = canvasStore

  const [search, setSearch] = useState('')
  const [kafkaConnections, setKafkaConnections] = useState<LibraryConnection[]>([])
  const [clickhouseConnections, setClickhouseConnections] = useState<LibraryConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const [kafkaRes, clickhouseRes] = await Promise.all([
          fetch('/ui-api/library/connections/kafka'),
          fetch('/ui-api/library/connections/clickhouse'),
        ])
        if (kafkaRes.ok) {
          const data = await kafkaRes.json() as LibraryConnection[]
          setKafkaConnections(Array.isArray(data) ? data : [])
        }
        if (clickhouseRes.ok) {
          const data = await clickhouseRes.json() as LibraryConnection[]
          setClickhouseConnections(Array.isArray(data) ? data : [])
        }
      } catch {
        // silently fail — library is optional
      } finally {
        setLoading(false)
      }
    }
    void fetchConnections()
  }, [])

  const filteredKafka = kafkaConnections.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredClickhouse = clickhouseConnections.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  )

  const applyKafkaConnection = (conn: LibraryConnection) => {
    const targetNodeId = activeNodeId ?? 'source'
    const cfg = conn.config
    setNodeConfig(targetNodeId, {
      bootstrapServers:
        typeof cfg.bootstrapServers === 'string'
          ? cfg.bootstrapServers
          : Array.isArray(cfg.brokers)
            ? (cfg.brokers as string[]).join(',')
            : '',
      ...cfg,
    })
  }

  const applyClickhouseConnection = (conn: LibraryConnection) => {
    const targetNodeId = activeNodeId ?? 'sink'
    setNodeConfig(targetNodeId, { ...conn.config })
  }

  return (
    <Card variant="dark" className="w-64 p-3 flex flex-col gap-3 shrink-0 overflow-y-auto">
      <h3 className="title-6 text-[var(--text-primary)]">Library</h3>
      <Input
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7"
      />

      {loading ? (
        <p className="body-3 text-[var(--text-secondary)]">Loading…</p>
      ) : (
        <>
          {/* Kafka Connections */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="caption-1 text-[var(--text-secondary)]">Kafka</span>
              <Badge variant="secondary">{filteredKafka.length}</Badge>
            </div>
            {filteredKafka.length === 0 ? (
              <p className="caption-1 text-[var(--text-secondary)]">No Kafka connections saved</p>
            ) : (
              filteredKafka.map((conn) => (
                <Button
                  key={conn.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => applyKafkaConnection(conn)}
                  title={conn.description ?? conn.name}
                >
                  <span className="truncate">{conn.name}</span>
                </Button>
              ))
            )}
          </div>

          {/* ClickHouse Connections */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="caption-1 text-[var(--text-secondary)]">ClickHouse</span>
              <Badge variant="secondary">{filteredClickhouse.length}</Badge>
            </div>
            {filteredClickhouse.length === 0 ? (
              <p className="caption-1 text-[var(--text-secondary)]">No ClickHouse connections saved</p>
            ) : (
              filteredClickhouse.map((conn) => (
                <Button
                  key={conn.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => applyClickhouseConnection(conn)}
                  title={conn.description ?? conn.name}
                >
                  <span className="truncate">{conn.name}</span>
                </Button>
              ))
            )}
          </div>
        </>
      )}
    </Card>
  )
}
