'use client'

import { useState, useCallback, useMemo } from 'react'
import { PlusIcon, SearchIcon, UploadIcon, LibraryBigIcon, ClockIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { PageShell } from '@/src/components/shared/page-shell'
import {
  useKafkaConnections,
  useClickhouseConnections,
  useLibraryFolders,
  useLibraryTransforms,
  useLibrarySchemas,
  type KafkaConnection,
  type ClickhouseConnection,
  type LibrarySchema,
  type LibraryFolder,
  type LibraryTransform,
} from '@/src/hooks/useLibraryConnections'
import { ConnectionsList } from './ConnectionsList'
import { TransformsList } from './TransformsList'
import { SchemaList } from './SchemaList'
import { KafkaConnectionFormModal } from './KafkaConnectionFormModal'
import { ClickHouseConnectionFormModal } from './ClickHouseConnectionFormModal'
import { TransformFormModal } from './TransformFormModal'
import { LibraryTableSkeleton } from './LibrarySkeletons'
import { LibrarySideNav, type LibrarySection, type LibraryCounts } from './LibrarySideNav'
import { LibraryTypeGlyph, type LibraryResourceType } from './LibraryTypeGlyph'
import { getApiUrl } from '@/src/utils/mock-api'

// ─── Delete helper ─────────────────────────────────────────────────────────────

async function deleteResource(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'DELETE' })
  return res.ok
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortItems<T extends { name: string; updatedAt: string }>(
  items: T[],
  sortBy: 'updated' | 'name' | 'usage',
): T[] {
  if (sortBy === 'name') return [...items].sort((a, b) => a.name.localeCompare(b.name))
  if (sortBy === 'usage')
    return [...items].sort(
      (a, b) =>
        (((b as Record<string, unknown>).usedByCount as number) ?? 0) -
        (((a as Record<string, unknown>).usedByCount as number) ?? 0),
    )
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_META: Record<LibrarySection, { title: string; description: string; addLabel?: string }> = {
  all: {
    title: 'All components',
    description: 'Every saved connection, schema, and processing config in one view.',
  },
  kafka: {
    title: 'Kafka connections',
    description: 'Saved Kafka cluster credentials, reusable across pipelines.',
    addLabel: 'Add connection',
  },
  clickhouse: {
    title: 'ClickHouse connections',
    description: 'Saved ClickHouse cluster credentials, reusable across pipelines.',
    addLabel: 'Add connection',
  },
  schemas: {
    title: 'Schemas',
    description: 'Reusable data blueprints. Pipelines bind to an instance of a schema at creation time.',
  },
  dedup: {
    title: 'Dedup configs',
    description: 'Saved deduplication window configurations, shared across pipelines.',
  },
  filter: {
    title: 'Filter configs',
    description: 'Saved filter expressions, bound to a schema and shared across pipelines.',
  },
  transforms: {
    title: 'Transform configs',
    description: 'Reusable JS or SQL transform functions, shareable across pipelines.',
    addLabel: 'Add transform',
  },
}

const SECTION_PLACEHOLDER: Record<LibrarySection, string> = {
  all: 'Search library…',
  kafka: 'Search connections…',
  clickhouse: 'Search connections…',
  schemas: 'Search schemas, fields, tags…',
  dedup: 'Search dedup configs…',
  filter: 'Search filter configs…',
  transforms: 'Search transforms…',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LibraryClient() {
  const [activeSection, setActiveSection] = useState<LibrarySection>('kafka')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'usage'>('updated')

  // Modal state
  const [kafkaModalOpen, setKafkaModalOpen] = useState(false)
  const [editingKafka, setEditingKafka] = useState<KafkaConnection | null>(null)
  const [chModalOpen, setChModalOpen] = useState(false)
  const [editingCH, setEditingCH] = useState<ClickhouseConnection | null>(null)
  const [transformModalOpen, setTransformModalOpen] = useState(false)
  const [editingTransform, setEditingTransform] = useState<LibraryTransform | null>(null)

  // Data
  const kafka = useKafkaConnections()
  const clickhouse = useClickhouseConnections()
  const transforms = useLibraryTransforms()
  const schemas = useLibrarySchemas()
  const folders = useLibraryFolders()

  // ─── Folder + tag filtering ────────────────────────────────────────────────

  function applyFolderFilter<T extends { folderId?: string | null }>(items: T[]): T[] {
    if (selectedFolderId === null) return items
    return items.filter((i) => i.folderId === selectedFolderId)
  }

  function applyTagFilter<T extends { tags?: string[] | null }>(items: T[]): T[] {
    if (!selectedTag) return items
    return items.filter((i) => (i.tags ?? []).includes(selectedTag))
  }

  const kafkaItems = sortItems(applyTagFilter(applyFolderFilter(kafka.data ?? [])), sortBy)
  const chItems = sortItems(applyTagFilter(applyFolderFilter(clickhouse.data ?? [])), sortBy)
  const transformItems = sortItems(applyTagFilter(applyFolderFilter(transforms.data ?? [])), sortBy)
  const schemaItems = sortItems(applyTagFilter(applyFolderFilter(schemas.data ?? [])), sortBy)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    ;[...kafkaItems, ...chItems, ...transformItems, ...schemaItems].forEach((item) =>
      (item.tags ?? []).forEach((t) => set.add(t)),
    )
    return Array.from(set).sort()
  }, [kafkaItems, chItems, transformItems, schemaItems])

  const counts: LibraryCounts = {
    all: kafkaItems.length + chItems.length + transformItems.length + schemaItems.length,
    kafka: kafkaItems.length,
    clickhouse: chItems.length,
    schemas: schemaItems.length,
    dedup: 0,
    filter: 0,
    transforms: transformItems.length,
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAddClick = useCallback(() => {
    if (activeSection === 'kafka') {
      setEditingKafka(null)
      setKafkaModalOpen(true)
    } else if (activeSection === 'clickhouse') {
      setEditingCH(null)
      setChModalOpen(true)
    } else if (activeSection === 'transforms') {
      setEditingTransform(null)
      setTransformModalOpen(true)
    }
  }, [activeSection])

  const handleEditKafka = useCallback(
    (id: string) => {
      setEditingKafka((kafka.data ?? []).find((c) => c.id === id) ?? null)
      setKafkaModalOpen(true)
    },
    [kafka.data],
  )

  const handleDeleteKafka = useCallback(
    async (id: string) => {
      if (!confirm('Delete this Kafka connection?')) return
      await deleteResource(getApiUrl(`library/connections/kafka/${id}`))
      kafka.mutate()
    },
    [kafka],
  )

  const handleEditCH = useCallback(
    (id: string) => {
      setEditingCH((clickhouse.data ?? []).find((c) => c.id === id) ?? null)
      setChModalOpen(true)
    },
    [clickhouse.data],
  )

  const handleDeleteCH = useCallback(
    async (id: string) => {
      if (!confirm('Delete this ClickHouse connection?')) return
      await deleteResource(getApiUrl(`library/connections/clickhouse/${id}`))
      clickhouse.mutate()
    },
    [clickhouse],
  )

  const handleEditTransform = useCallback(
    (id: string) => {
      setEditingTransform((transforms.data ?? []).find((x) => x.id === id) ?? null)
      setTransformModalOpen(true)
    },
    [transforms.data],
  )

  const handleDeleteTransform = useCallback(
    async (id: string) => {
      if (!confirm('Delete this transform?')) return
      await deleteResource(getApiUrl(`library/transforms/${id}`))
      transforms.mutate()
    },
    [transforms],
  )

  // ─── Computed ─────────────────────────────────────────────────────────────

  const { title, description, addLabel } = SECTION_META[activeSection]
  const canAdd = !!addLabel
  const foldersData = folders.data ?? []

  const sortOptions: { value: 'updated' | 'name' | 'usage'; label: string }[] = [
    { value: 'updated', label: 'Updated' },
    { value: 'name', label: 'Name' },
    ...(activeSection === 'schemas' ? [{ value: 'usage' as const, label: 'Usage' }] : []),
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  const sidebar = (
    <LibrarySideNav
      activeSection={activeSection}
      onSectionChange={(s) => {
        setActiveSection(s)
        setSearchQuery('')
        if (s !== 'schemas' && sortBy === 'usage') setSortBy('updated')
      }}
      counts={counts}
      folders={foldersData}
      selectedFolderId={selectedFolderId}
      onFolderChange={setSelectedFolderId}
      allTags={allTags}
      selectedTag={selectedTag}
      onTagChange={setSelectedTag}
    />
  )

  const actions = (
    <>
      {activeSection === 'schemas' && (
        <Button variant="secondary" size="sm">
          <UploadIcon size={13} className="mr-1.5" />
          Import
        </Button>
      )}
      {canAdd && (
        <Button variant="primary" size="sm" onClick={handleAddClick}>
          <PlusIcon size={14} className="mr-1.5" />
          {addLabel}
        </Button>
      )}
    </>
  )

  return (
    <>
      <PageShell
        title={title}
        subtitle={description}
        crumbs={[{ label: 'Library', href: '/library' }, { label: title }]}
        actions={actions}
        sidebar={sidebar}
      >
        {/* Content — key forces re-mount + re-animation on section change */}
        <div key={activeSection} className="animate-section-enter flex flex-col gap-4">
          {/* Filter bar: search + sort */}
          <div className="lib-filter-bar">
            <div className="relative flex-1 min-w-[180px] max-w-[360px]">
              <SearchIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
              />
              <Input
                placeholder={SECTION_PLACEHOLDER[activeSection]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="lib-sort-label">Sort</span>
              {sortOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSortBy(value)}
                  className={`lib-filter-chip${sortBy === value ? ' is-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Section content */}
          <SectionContent
            activeSection={activeSection}
            searchQuery={searchQuery}
            kafkaItems={kafkaItems}
            chItems={chItems}
            transformItems={transformItems}
            schemaItems={schemaItems}
            foldersData={foldersData}
            kafka={kafka}
            clickhouse={clickhouse}
            transforms={transforms}
            schemas={schemas}
            onEditKafka={handleEditKafka}
            onDeleteKafka={handleDeleteKafka}
            onEditCH={handleEditCH}
            onDeleteCH={handleDeleteCH}
            onEditTransform={handleEditTransform}
            onDeleteTransform={handleDeleteTransform}
            onSectionChange={setActiveSection}
          />
        </div>
      </PageShell>

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
      <TransformFormModal
        open={transformModalOpen}
        onClose={() => setTransformModalOpen(false)}
        onSaved={() => transforms.mutate()}
        transform={editingTransform}
      />
    </>
  )
}

// ─── Section content dispatcher ────────────────────────────────────────────────

type SectionContentProps = {
  activeSection: LibrarySection
  searchQuery: string
  kafkaItems: KafkaConnection[]
  chItems: ClickhouseConnection[]
  transformItems: LibraryTransform[]
  schemaItems: LibrarySchema[]
  foldersData: LibraryFolder[]
  kafka: ReturnType<typeof useKafkaConnections>
  clickhouse: ReturnType<typeof useClickhouseConnections>
  transforms: ReturnType<typeof useLibraryTransforms>
  schemas: ReturnType<typeof useLibrarySchemas>
  onEditKafka: (id: string) => void
  onDeleteKafka: (id: string) => Promise<void>
  onEditCH: (id: string) => void
  onDeleteCH: (id: string) => Promise<void>
  onEditTransform: (id: string) => void
  onDeleteTransform: (id: string) => Promise<void>
  onSectionChange: (s: LibrarySection) => void
}

function SectionContent({
  activeSection,
  searchQuery,
  kafkaItems,
  chItems,
  transformItems,
  schemaItems,
  foldersData,
  kafka,
  clickhouse,
  transforms,
  schemas,
  onEditKafka,
  onDeleteKafka,
  onEditCH,
  onDeleteCH,
  onEditTransform,
  onDeleteTransform,
  onSectionChange,
}: SectionContentProps) {
  if (activeSection === 'kafka') {
    if (kafka.isLoading) return <LibraryTableSkeleton />
    if (kafka.error) return <ErrorState message={kafka.error} />
    return (
      <ConnectionsList
        connections={kafkaItems}
        kind="kafka"
        searchQuery={searchQuery}
        onEdit={onEditKafka}
        onDelete={onDeleteKafka}
        emptyLabel="No Kafka connections saved yet."
        folders={foldersData}
      />
    )
  }

  if (activeSection === 'clickhouse') {
    if (clickhouse.isLoading) return <LibraryTableSkeleton />
    if (clickhouse.error) return <ErrorState message={clickhouse.error} />
    return (
      <ConnectionsList
        connections={chItems}
        kind="clickhouse"
        searchQuery={searchQuery}
        onEdit={onEditCH}
        onDelete={onDeleteCH}
        emptyLabel="No ClickHouse connections saved yet."
        folders={foldersData}
      />
    )
  }

  if (activeSection === 'schemas') {
    if (schemas.isLoading) return <LibraryTableSkeleton />
    if (schemas.error) return <ErrorState message={schemas.error} />
    return (
      <SchemaList
        schemas={schemaItems}
        searchQuery={searchQuery}
        onEdit={() => {}}
        onDelete={() => {}}
        folders={foldersData}
        showFilters
      />
    )
  }

  if (activeSection === 'transforms') {
    if (transforms.isLoading) return <LibraryTableSkeleton />
    if (transforms.error) return <ErrorState message={transforms.error} />
    return (
      <TransformsList
        transforms={transformItems}
        searchQuery={searchQuery}
        onEdit={onEditTransform}
        onDelete={onDeleteTransform}
        folders={foldersData}
      />
    )
  }

  if (activeSection === 'dedup') {
    return (
      <LibrarySectionComingSoon
        name="Dedup configs"
        description="Save named deduplication windows — key fields, time window, and strategy — and reuse them across pipelines without reconfiguring each time."
      />
    )
  }

  if (activeSection === 'filter') {
    return (
      <LibrarySectionComingSoon
        name="Filter configs"
        description="Save filter expressions bound to a schema and share them across pipelines. Filters will be selectable from the wizard and canvas."
      />
    )
  }

  // "all" section — grouped flat tables
  const isLoading = kafka.isLoading || clickhouse.isLoading || transforms.isLoading || schemas.isLoading
  if (isLoading) return <LibraryTableSkeleton rows={8} />

  const hasAny = kafkaItems.length > 0 || chItems.length > 0 || transformItems.length > 0 || schemaItems.length > 0

  if (!hasAny) {
    return <LibraryFirstRunEmptyState onSectionChange={onSectionChange} />
  }

  return (
    <div className="flex flex-col gap-8">
      {kafkaItems.length > 0 && (
        <GroupedSection label="Kafka connections">
          <ConnectionsList
            connections={kafkaItems}
            kind="kafka"
            searchQuery={searchQuery}
            onEdit={onEditKafka}
            onDelete={onDeleteKafka}
            folders={foldersData}
          />
        </GroupedSection>
      )}
      {chItems.length > 0 && (
        <GroupedSection label="ClickHouse connections">
          <ConnectionsList
            connections={chItems}
            kind="clickhouse"
            searchQuery={searchQuery}
            onEdit={onEditCH}
            onDelete={onDeleteCH}
            folders={foldersData}
          />
        </GroupedSection>
      )}
      {schemaItems.length > 0 && (
        <GroupedSection label="Schemas">
          <SchemaList
            schemas={schemaItems}
            searchQuery={searchQuery}
            onEdit={() => {}}
            onDelete={() => {}}
            folders={foldersData}
            showFilters={false}
          />
        </GroupedSection>
      )}
      {transformItems.length > 0 && (
        <GroupedSection label="Transform configs">
          <TransformsList
            transforms={transformItems}
            searchQuery={searchQuery}
            onEdit={onEditTransform}
            onDelete={onDeleteTransform}
            folders={foldersData}
          />
        </GroupedSection>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupedSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="lib-group-label">{label}</p>
      {children}
    </section>
  )
}

function LibraryFirstRunEmptyState({ onSectionChange }: { onSectionChange: (s: LibrarySection) => void }) {
  const quickStarts: { section: LibrarySection; glyphType: LibraryResourceType; label: string; desc: string }[] = [
    { section: 'kafka', glyphType: 'kafka', label: 'Add Kafka connection', desc: 'Bootstrap servers, auth' },
    {
      section: 'clickhouse',
      glyphType: 'clickhouse',
      label: 'Add ClickHouse connection',
      desc: 'Host, credentials, SSL',
    },
    { section: 'schemas', glyphType: 'schema', label: 'Browse schemas', desc: 'Derive from topic or manual' },
    { section: 'filter', glyphType: 'filter', label: 'Save a filter', desc: 'Bound to a schema' },
  ]

  return (
    <div className="rounded-xl border border-[var(--color-gray-dark-700)] bg-[var(--table-header-bg)] p-10 flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-5 text-center max-w-[520px]">
        <div
          className="w-[72px] h-[72px] rounded-2xl grid place-items-center border shrink-0"
          style={{
            backgroundColor: 'var(--glyph-ch-bg)',
            borderColor: 'var(--glyph-ch-border)',
            color: 'var(--glyph-ch-color)',
          }}
        >
          <LibraryBigIcon size={32} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="title-3 text-[var(--text-primary)]">Your library is empty</h2>
          <p className="body-3 text-[var(--text-secondary)]">
            Save connections and schemas as you build pipelines, or seed your library now. Library items become
            available in the wizard and canvas the moment they&apos;re saved.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        {quickStarts.map(({ section, glyphType, label, desc }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            className="text-left p-4 rounded-lg border border-[var(--color-gray-dark-700)] bg-[var(--table-row-bg)] hover:border-[var(--color-gray-dark-500)] hover:bg-[var(--table-row-bg-hover)] transition-colors flex flex-col gap-3 focus-ring"
          >
            <LibraryTypeGlyph type={glyphType} size="md" />
            <div>
              <p className="body-3 text-[var(--text-primary)] font-medium">{label}</p>
              <p className="caption-1 text-[var(--text-tertiary)] mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="caption-1 text-[var(--text-tertiary)] text-center">
        Prefer to start with a pipeline?{' '}
        <a href="/pipelines/create" className="text-[var(--color-foreground-primary)] hover:underline">
          Open the Create wizard
        </a>{' '}
        — you can save connections to the library from there.
      </p>
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

function LibrarySectionComingSoon({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl border border-[var(--color-gray-dark-700)] grid place-items-center text-[var(--text-tertiary)]">
          <ClockIcon size={22} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="body-2 font-medium text-[var(--text-primary)]">{name} — coming soon</p>
          <p className="body-3 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
    </div>
  )
}
