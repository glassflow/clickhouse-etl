'use client'

import { useState } from 'react'
import { PlusIcon, SearchIcon, UploadIcon, DatabaseIcon, FilterIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Badge } from '@/src/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/src/components/ui/data-table'
import { PageShell } from '@/src/components/shared/page-shell'
import { Section, PageHeader, CodeBlock } from '../_components/Section'

// ─── Demo data ─────────────────────────────────────────────────────

type DemoRow = {
  id: string
  name: string
  topic: string
  status: 'active' | 'paused' | 'failed'
}

const demoRows: DemoRow[] = [
  { id: 'p1', name: 'orders-ingest', topic: 'orders.raw', status: 'active' },
  { id: 'p2', name: 'events-dedup', topic: 'events.dedup', status: 'paused' },
  { id: 'p3', name: 'sessions-rollup', topic: 'sessions.raw', status: 'active' },
]

const statusVariant: Record<DemoRow['status'], 'success' | 'warning' | 'error'> = {
  active: 'success',
  paused: 'warning',
  failed: 'error',
}

const demoColumns: DataTableColumn<DemoRow>[] = [
  {
    key: 'name',
    header: 'Pipeline',
    width: '2fr',
    sortable: true,
    render: (r) => <span className="body-3 font-medium text-[var(--text-primary)]">{r.name}</span>,
  },
  {
    key: 'topic',
    header: 'Topic',
    width: '1.5fr',
    render: (r) => <span className="caption-1 font-mono text-[var(--text-secondary)]">{r.topic}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    width: '1fr',
    sortable: true,
    render: (r) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge>,
  },
]

// ─── Demo sidebar (matches Library shape) ──────────────────────────

type SectionKey = 'all' | 'kafka' | 'clickhouse' | 'schemas'

function DemoLibrarySideNav({ active, onChange }: { active: SectionKey; onChange: (s: SectionKey) => void }) {
  const items: { key: SectionKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'All', icon: <DatabaseIcon size={14} />, count: 18 },
    { key: 'kafka', label: 'Kafka', icon: <DatabaseIcon size={14} />, count: 6 },
    { key: 'clickhouse', label: 'ClickHouse', icon: <DatabaseIcon size={14} />, count: 4 },
    { key: 'schemas', label: 'Schemas', icon: <FilterIcon size={14} />, count: 8 },
  ]
  return (
    <nav className="w-[200px] flex flex-col gap-0.5" aria-label="Library sections">
      <p className="caption-1 font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2 px-2">Sections</p>
      {items.map(({ key, label, icon, count }) => {
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={[
              'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md body-3 transition-colors focus-ring text-left',
              isActive
                ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover-bg)]',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              {icon}
              {label}
            </span>
            <span className="caption-1 font-mono text-[var(--text-secondary)]">{count}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Demo filter bar (matches Pipelines shape) ─────────────────────

function DemoFilterBar({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
}: {
  query: string
  onQueryChange: (v: string) => void
  sortBy: 'updated' | 'name'
  onSortChange: (s: 'updated' | 'name') => void
}) {
  return (
    <>
      <div className="relative flex-1 min-w-[200px] max-w-[360px]">
        <SearchIcon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
        />
        <Input placeholder="Search…" value={query} onChange={(e) => onQueryChange(e.target.value)} className="pl-8" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="caption-1 font-mono uppercase tracking-widest text-[var(--text-secondary)]">Sort</span>
        <Button
          variant={sortBy === 'updated' ? 'primary' : 'ghostOutline'}
          size="sm"
          onClick={() => onSortChange('updated')}
        >
          Updated
        </Button>
        <Button variant={sortBy === 'name' ? 'primary' : 'ghostOutline'} size="sm" onClick={() => onSortChange('name')}>
          Name
        </Button>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ShellShowcasePage() {
  return (
    <div>
      <PageHeader
        title="Shell"
        description="<PageShell> is the page-level scaffolding inside the global app shell. It owns breadcrumbs, header (title + subtitle + actions), an optional filters row, an optional left sidebar, and the body. Page background, max-width, and outer padding come from the (shell) route group — PageShell never sets those."
      />

      {/* Each preview shows the API + a live in-frame render */}
      <Section
        title="Dashboard layout"
        description="Title + actions on the right, no breadcrumbs, no sidebar. Matches the Dashboard's expected shape after Phase 6 migration."
      >
        <DashboardLayoutDemo />
        <CodeBlock
          code={`<PageShell
  title="Dashboard"
  subtitle="Everything's running smoothly · 12 pipelines active"
  actions={
    <>
      <Button variant="ghost" size="sm">Documentation</Button>
      <Button variant="primary" size="sm">+ New pipeline</Button>
    </>
  }
>
  <KpiStrip stats={...} />
  <ThroughputChart stats={...} />
  <PipelineTable pipelines={...} />
</PageShell>`}
        />
      </Section>

      <Section
        title="List page layout"
        description="Title + subtitle + actions, with a filters toolbar beneath the header. Matches the Pipelines list."
      >
        <ListLayoutDemo />
        <CodeBlock
          code={`<PageShell
  title="Pipelines"
  subtitle={\`\${total} pipelines · 2 environments · 3 teams\`}
  actions={
    <>
      <Button variant="ghost" size="sm">Import</Button>
      <Button variant="primary" size="custom">+ Create pipeline</Button>
    </>
  }
  filters={
    <>
      <Input placeholder="Search…" />
      <Button variant="ghostOutline" size="sm">Filter</Button>
    </>
  }
>
  <DataTable data={filtered} columns={columns} getRowId={(p) => p.id} />
</PageShell>`}
        />
      </Section>

      <Section
        title="Sidebar layout"
        description="Sidebar on the left, body on the right, with crumbs + header above both. Matches the Library."
      >
        <SidebarLayoutDemo />
        <CodeBlock
          code={`<PageShell
  title="Kafka connections"
  subtitle="Saved Kafka cluster credentials, reusable across pipelines."
  crumbs={[{ label: 'Library', href: '/library' }, { label: 'Kafka' }]}
  actions={<Button variant="primary" size="sm">+ Add connection</Button>}
  sidebar={<LibrarySideNav activeSection={section} onSectionChange={setSection} />}
>
  <ConnectionsList connections={items} />
</PageShell>`}
        />
      </Section>

      <Section
        title="Density"
        description='Use density="compact" for embedded or dense-data pages where the header should take less vertical space.'
      >
        <DensityDemo />
        <CodeBlock
          code={`<PageShell density="compact" title="Logs" subtitle="…">
  …
</PageShell>`}
        />
      </Section>
    </div>
  )
}

// ─── Demos ────────────────────────────────────────────────────────

function ShellFrame({ children }: { children: React.ReactNode }) {
  // A frame that mimics the (shell) outer layout (px + bg + max-width)
  // so the preview shows PageShell in its real composition context.
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--color-surface-page)] overflow-hidden">
      <div className="px-6 py-5 max-w-[var(--shell-max-width)] mx-auto w-full">{children}</div>
    </div>
  )
}

function DashboardLayoutDemo() {
  return (
    <ShellFrame>
      <PageShell
        title="Dashboard"
        subtitle="Everything's running smoothly · 12 pipelines active"
        actions={
          <>
            <Button variant="ghost" size="sm">
              Documentation
            </Button>
            <Button variant="primary" size="sm">
              <PlusIcon size={14} className="mr-1.5" />
              New pipeline
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          {['Events/sec', 'Error rate', 'Avg lag'].map((k) => (
            <div key={k} className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg)] p-4">
              <p className="caption-1 font-mono uppercase tracking-widest text-[var(--text-secondary)]">{k}</p>
              <p className="title-5 text-[var(--text-primary)] mt-1">42.1k</p>
            </div>
          ))}
        </div>
      </PageShell>
    </ShellFrame>
  )
}

function ListLayoutDemo() {
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated')

  const filtered = demoRows.filter((r) =>
    query.trim() === '' ? true : r.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <ShellFrame>
      <PageShell
        title="Pipelines"
        subtitle="3 pipelines · 2 environments · 1 team"
        actions={
          <>
            <Button variant="ghost" size="sm">
              <UploadIcon size={14} className="mr-1.5" />
              Import
            </Button>
            <Button variant="primary" size="sm">
              <PlusIcon size={14} className="mr-1.5" />
              Create pipeline
            </Button>
          </>
        }
        filters={<DemoFilterBar query={query} onQueryChange={setQuery} sortBy={sortBy} onSortChange={setSortBy} />}
      >
        <DataTable<DemoRow>
          ariaLabel="Demo pipelines"
          data={filtered}
          columns={demoColumns}
          getRowId={(r) => r.id}
          density="compact"
          stickyHeader
        />
      </PageShell>
    </ShellFrame>
  )
}

function SidebarLayoutDemo() {
  const [section, setSection] = useState<SectionKey>('kafka')

  return (
    <ShellFrame>
      <PageShell
        title="Kafka connections"
        subtitle="Saved Kafka cluster credentials, reusable across pipelines."
        crumbs={[{ label: 'Library', href: '#' }, { label: 'Kafka' }]}
        actions={
          <Button variant="primary" size="sm">
            <PlusIcon size={14} className="mr-1.5" />
            Add connection
          </Button>
        }
        sidebar={<DemoLibrarySideNav active={section} onChange={setSection} />}
      >
        <DataTable<DemoRow>
          ariaLabel="Demo connections"
          data={demoRows}
          columns={demoColumns}
          getRowId={(r) => r.id}
          density="compact"
        />
      </PageShell>
    </ShellFrame>
  )
}

function DensityDemo() {
  return (
    <div className="flex flex-col gap-4">
      <ShellFrame>
        <PageShell
          density="comfortable"
          title="Comfortable"
          subtitle="Default density — title-3, generous header padding"
        >
          <p className="body-3 text-[var(--text-secondary)]">Body content</p>
        </PageShell>
      </ShellFrame>
      <ShellFrame>
        <PageShell density="compact" title="Compact" subtitle="Smaller title (title-4), tighter header padding">
          <p className="body-3 text-[var(--text-secondary)]">Body content</p>
        </PageShell>
      </ShellFrame>
    </div>
  )
}
