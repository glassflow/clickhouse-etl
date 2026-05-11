'use client'

import { useState, useCallback, useMemo } from 'react'
import { PlusIcon, SearchIcon, SortAscIcon, UploadIcon, LibraryBigIcon, ClockIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Crumbs } from '@/src/components/ui/crumbs'
import {
  useKafkaConnections,
  useClickhouseConnections,
  useLibraryFolders,
  useLibraryTransforms,
  type KafkaConnection,
  type ClickhouseConnection,
  type LibraryFolder,
  type LibraryTransform,
} from '@/src/hooks/useLibraryConnections'
import { ConnectionsList } from './ConnectionsList'
import { TransformsList } from './TransformsList'
import { KafkaConnectionFormModal } from './KafkaConnectionFormModal'
import { ClickHouseConnectionFormModal } from './ClickHouseConnectionFormModal'
import { TransformFormModal } from './TransformFormModal'
import { LibraryGridSkeleton } from './LibrarySkeletons'
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
        ((b as Record<string, unknown>).usedByCount as number ?? 0) -
        ((a as Record<string, unknown>).usedByCount as number ?? 0),
    )
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_META: Record<
  LibrarySection,
  { title: string; description: string; addLabel?: string }
> = {
  all: {
    title: 'All components',
    description: 'Every saved connection, schema, and processing config in one view.',
  },
  kafka: {
    title: 'Kafka connections',
    description: 'Saved Kafka cluster credentials, reusable across pipelines.',
    addLabel: 'Add Kafka connection',
  },
  clickhouse: {
    title: 'ClickHouse connections',
    description: 'Saved ClickHouse cluster credentials, reusable across pipelines.',
    addLabel: 'Add ClickHouse connection',
  },
  schemas: {
    title: 'Schemas',
    description: 'Reusable data blueprints. Pipelines bind to a schema at creation time.',
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

  // Derive all tags across live sections only (schemas/dedup/filter are coming soon)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    ;[...kafkaItems, ...chItems, ...transformItems].forEach((item) =>
      (item.tags ?? []).forEach((t) => set.add(t)),
    )
    return Array.from(set).sort()
  }, [kafkaItems, chItems, transformItems])

  // Counts for sidebar (coming-soon sections always show 0 — sidebar renders "soon" badge instead)
  const counts: LibraryCounts = {
    all: kafkaItems.length + chItems.length + transformItems.length,
    kafka: kafkaItems.length,
    clickhouse: chItems.length,
    schemas: 0,
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
      const conn = (kafka.data ?? []).find((c) => c.id === id) ?? null
      setEditingKafka(conn)
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
      const conn = (clickhouse.data ?? []).find((c) => c.id === id) ?? null
      setEditingCH(conn)
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
      const t = (transforms.data ?? []).find((x) => x.id === id) ?? null
      setEditingTransform(t)
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-fadeIn w-full">
      {/* Breadcrumb */}
      <Crumbs crumbs={[{ label: 'Library', href: '/library' }, { label: title }]} />

      {/* Main layout: sidebar + content */}
      <div className="flex gap-8">
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

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Section header — aligned with content, not sidebar */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="title-2 text-[var(--text-primary)]">{title}</h1>
              <p className="body-3 text-[var(--text-secondary)]">{description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-[360px]">
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

            {/* Sort */}
            <div className="ml-auto flex items-center gap-2">
              <SortAscIcon size={13} className="text-[var(--text-tertiary)]" />
              <SortButtons
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'updated', label: 'Updated' },
                  { value: 'name', label: 'Name' },
                  ...(activeSection === 'schemas' ? [{ value: 'usage' as const, label: 'Usage' }] : []),
                ]}
              />
            </div>
          </div>

          {/* Section content */}
          <SectionContent
            activeSection={activeSection}
            searchQuery={searchQuery}
            kafkaItems={kafkaItems}
            chItems={chItems}
            transformItems={transformItems}
            foldersData={foldersData}
            kafka={kafka}
            clickhouse={clickhouse}
            transforms={transforms}
            onEditKafka={handleEditKafka}
            onDeleteKafka={handleDeleteKafka}
            onEditCH={handleEditCH}
            onDeleteCH={handleDeleteCH}
            onEditTransform={handleEditTransform}
            onDeleteTransform={handleDeleteTransform}
            onSectionChange={setActiveSection}
          />
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
      <TransformFormModal
        open={transformModalOpen}
        onClose={() => setTransformModalOpen(false)}
        onSaved={() => transforms.mutate()}
        transform={editingTransform}
      />
    </div>
  )
}

// ─── Section content dispatcher ────────────────────────────────────────────────

type SectionContentProps = {
  activeSection: LibrarySection
  searchQuery: string
  kafkaItems: KafkaConnection[]
  chItems: ClickhouseConnection[]
  transformItems: LibraryTransform[]
  foldersData: LibraryFolder[]
  kafka: ReturnType<typeof useKafkaConnections>
  clickhouse: ReturnType<typeof useClickhouseConnections>
  transforms: ReturnType<typeof useLibraryTransforms>
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
  foldersData,
  kafka,
  clickhouse,
  transforms,
  onEditKafka,
  onDeleteKafka,
  onEditCH,
  onDeleteCH,
  onEditTransform,
  onDeleteTransform,
  onSectionChange,
}: SectionContentProps) {
  if (activeSection === 'kafka') {
    if (kafka.isLoading) return <LibraryGridSkeleton />
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
    if (clickhouse.isLoading) return <LibraryGridSkeleton />
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
    return <LibrarySectionComingSoon name="Schemas" description="Save reusable schemas derived from Kafka topics. Once saved, schemas will be available to bind to pipelines and processing configs." />
  }

  if (activeSection === 'transforms') {
    if (transforms.isLoading) return <LibraryGridSkeleton />
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
    return <LibrarySectionComingSoon name="Dedup configs" description="Save named deduplication windows — key fields, time window, and strategy — and reuse them across pipelines without reconfiguring each time." />
  }

  if (activeSection === 'filter') {
    return <LibrarySectionComingSoon name="Filter configs" description="Save filter expressions bound to a schema and share them across pipelines. Filters will be selectable from the wizard and canvas." />
  }

  // "all" section — grouped view (schemas/dedup/filter are coming soon, not shown here)
  const isLoading = kafka.isLoading || clickhouse.isLoading || transforms.isLoading
  if (isLoading) return <LibraryGridSkeleton count={9} />

  const hasAny =
    kafkaItems.length > 0 ||
    chItems.length > 0 ||
    transformItems.length > 0

  if (!hasAny) {
    return (
      <LibraryFirstRunEmptyState onSectionChange={onSectionChange} />
    )
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
      <h2 className="caption-1 text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
        {label}
      </h2>
      {children}
    </section>
  )
}

function SortButtons<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div
      className="flex rounded-md border border-[var(--surface-border)] overflow-hidden bg-[var(--color-background-elevation-raised-faded)]"
      role="group"
    >
      {options.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={[
            'px-3 py-1.5 caption-1 transition-colors',
            value === v
              ? 'bg-[var(--surface-bg)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function LibraryFirstRunEmptyState({
  onSectionChange,
}: {
  onSectionChange: (s: LibrarySection) => void
}) {
  const quickStarts: { section: LibrarySection; glyphType: LibraryResourceType; label: string; desc: string }[] = [
    { section: 'kafka',      glyphType: 'kafka',      label: 'Add Kafka connection',      desc: 'Bootstrap servers, auth' },
    { section: 'clickhouse', glyphType: 'clickhouse', label: 'Add ClickHouse connection', desc: 'Host, credentials, SSL' },
    { section: 'schemas',    glyphType: 'schema',     label: 'Define a schema',           desc: 'Derive from topic or manual' },
    { section: 'filter',     glyphType: 'filter',     label: 'Save a filter',             desc: 'Bound to a schema' },
  ]

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-10 flex flex-col items-center gap-8">
      {/* Hero icon + headline */}
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
            Save connections and schemas as you build pipelines, or seed your library now.{' '}
            Library items become available in the wizard and canvas the moment they&apos;re saved.
          </p>
        </div>
      </div>

      {/* Quick-start cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        {quickStarts.map(({ section, glyphType, label, desc }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            className="text-left p-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg)] hover:border-[var(--color-gray-dark-300)] hover:bg-[var(--interactive-hover-bg)] transition-colors flex flex-col gap-3"
          >
            <LibraryTypeGlyph type={glyphType} size="md" />
            <div>
              <p className="body-3 text-[var(--text-primary)] font-medium">{label}</p>
              <p className="caption-1 text-[var(--text-tertiary)] mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer CTA */}
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
        <div className="w-12 h-12 rounded-xl border border-[var(--surface-border)] grid place-items-center text-[var(--text-tertiary)]">
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
