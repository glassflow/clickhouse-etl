'use client'

import { useState, useCallback } from 'react'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import {
  useKafkaConnections,
  useClickhouseConnections,
  useLibrarySchemas,
  useLibraryFolders,
  type KafkaConnection,
  type ClickhouseConnection,
} from '@/src/hooks/useLibraryConnections'
import { ConnectionsList } from './ConnectionsList'
import { SchemaList } from './SchemaList'
import { FolderTree } from './FolderTree'
import { KafkaConnectionFormModal } from './KafkaConnectionFormModal'
import { ClickHouseConnectionFormModal } from './ClickHouseConnectionFormModal'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'kafka' | 'clickhouse' | 'schemas'

// ─── Delete confirmation (inline, no extra modal) ─────────────────────────────

async function deleteResource(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'DELETE' })
  return res.ok
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LibraryClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kafka')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Modal state
  const [kafkaModalOpen, setKafkaModalOpen] = useState(false)
  const [editingKafka, setEditingKafka] = useState<KafkaConnection | null>(null)
  const [chModalOpen, setChModalOpen] = useState(false)
  const [editingCH, setEditingCH] = useState<ClickhouseConnection | null>(null)

  // Data
  const kafka = useKafkaConnections()
  const clickhouse = useClickhouseConnections()
  const schemas = useLibrarySchemas()
  const folders = useLibraryFolders()

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddClick = useCallback(() => {
    if (activeTab === 'kafka') {
      setEditingKafka(null)
      setKafkaModalOpen(true)
    } else if (activeTab === 'clickhouse') {
      setEditingCH(null)
      setChModalOpen(true)
    }
    // schemas: TODO in Sprint 3
  }, [activeTab])

  const handleEditKafka = useCallback(
    (id: string) => {
      const conn = (kafka.data ?? []).find((c) => c.id === id) ?? null
      setEditingKafka(conn)
      setKafkaModalOpen(true)
    },
    [kafka.data],
  )

  const handleDeleteKafka = useCallback(
    async (id: string) => {
      if (!confirm('Delete this Kafka connection?')) return
      await deleteResource(`/ui-api/library/connections/kafka/${id}`)
      kafka.mutate()
    },
    [kafka],
  )

  const handleEditCH = useCallback(
    (id: string) => {
      const conn = (clickhouse.data ?? []).find((c) => c.id === id) ?? null
      setEditingCH(conn)
      setChModalOpen(true)
    },
    [clickhouse.data],
  )

  const handleDeleteCH = useCallback(
    async (id: string) => {
      if (!confirm('Delete this ClickHouse connection?')) return
      await deleteResource(`/ui-api/library/connections/clickhouse/${id}`)
      clickhouse.mutate()
    },
    [clickhouse],
  )

  const handleDeleteSchema = useCallback(
    async (id: string) => {
      if (!confirm('Delete this schema?')) return
      await deleteResource(`/ui-api/library/schemas/${id}`)
      schemas.mutate()
    },
    [schemas],
  )

  // ─── Folder filtering ──────────────────────────────────────────────────────

  function applyFolderFilter<T extends { folderId?: string | null }>(items: T[]): T[] {
    if (selectedFolderId === null) return items
    return items.filter((i) => i.folderId === selectedFolderId)
  }

  const kafkaItems = applyFolderFilter(kafka.data ?? [])
  const chItems = applyFolderFilter(clickhouse.data ?? [])
  const schemaItems = applyFolderFilter(schemas.data ?? [])

  const canAdd = activeTab !== 'schemas'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="title-2 text-[var(--text-primary)]">Library</h1>
          <p className="body-3 text-[var(--text-secondary)]">
            Saved connections and schema definitions for reuse across pipelines
          </p>
        </div>
        {canAdd && (
          <Button variant="primary" size="sm" onClick={handleAddClick}>
            <PlusIcon size={14} className="mr-1.5" />
            Add
          </Button>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Folder sidebar */}
        <aside className="w-44 shrink-0">
          <p className="caption-1 text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            Folders
          </p>
          <FolderTree
            folders={folders.data ?? []}
            selectedFolderId={selectedFolderId}
            onSelect={setSelectedFolderId}
          />
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="kafka">
                  Kafka Connections
                  {kafka.data && (
                    <span className="ml-1.5 caption-1 text-[var(--text-tertiary)]">
                      ({kafkaItems.length})
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="clickhouse">
                  ClickHouse
                  {clickhouse.data && (
                    <span className="ml-1.5 caption-1 text-[var(--text-tertiary)]">
                      ({chItems.length})
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="schemas">
                  Schemas
                  {schemas.data && (
                    <span className="ml-1.5 caption-1 text-[var(--text-tertiary)]">
                      ({schemaItems.length})
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Search */}
              <div className="relative w-56">
                <SearchIcon
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
                />
                <Input
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Tab panels */}
            <TabsContent value="kafka">
              {kafka.isLoading ? (
                <LoadingState />
              ) : kafka.error ? (
                <ErrorState message={kafka.error} />
              ) : (
                <ConnectionsList
                  connections={kafkaItems}
                  searchQuery={searchQuery}
                  onEdit={handleEditKafka}
                  onDelete={handleDeleteKafka}
                  emptyLabel="No Kafka connections saved yet."
                />
              )}
            </TabsContent>

            <TabsContent value="clickhouse">
              {clickhouse.isLoading ? (
                <LoadingState />
              ) : clickhouse.error ? (
                <ErrorState message={clickhouse.error} />
              ) : (
                <ConnectionsList
                  connections={chItems}
                  searchQuery={searchQuery}
                  onEdit={handleEditCH}
                  onDelete={handleDeleteCH}
                  emptyLabel="No ClickHouse connections saved yet."
                />
              )}
            </TabsContent>

            <TabsContent value="schemas">
              {schemas.isLoading ? (
                <LoadingState />
              ) : schemas.error ? (
                <ErrorState message={schemas.error} />
              ) : (
                <SchemaList
                  schemas={schemaItems}
                  searchQuery={searchQuery}
                  onEdit={() => {}} // TODO Sprint 3
                  onDelete={handleDeleteSchema}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <KafkaConnectionFormModal
        open={kafkaModalOpen}
        onClose={() => setKafkaModalOpen(false)}
        onSaved={() => kafka.mutate()}
        connection={editingKafka}
      />
      <ClickHouseConnectionFormModal
        open={chModalOpen}
        onClose={() => setChModalOpen(false)}
        onSaved={() => clickhouse.mutate()}
        connection={editingCH}
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="body-3 text-[var(--text-secondary)] animate-pulse">Loading…</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="body-3 text-[var(--color-foreground-critical)]">Error: {message}</p>
    </div>
  )
}
