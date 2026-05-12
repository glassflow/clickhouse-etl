'use client'

import { useState } from 'react'
import { InboxIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { DataTable, type DataTableColumn } from '@/src/components/ui/data-table'
import { EmptyState } from '@/src/components/ui/empty-state'
import { Input } from '@/src/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { PageShell } from '@/src/components/shared/page-shell'
import { Section, PageHeader, CodeBlock } from '../_components/Section'

// ─── Shared demo types ────────────────────────────────────────────────────────

type DemoPipeline = {
  id: string
  name: string
  topic: string
  status: 'active' | 'paused' | 'failed'
  events: number
}

const demoPipelines: DemoPipeline[] = [
  { id: 'p1', name: 'kafka-prod-ingest', topic: 'events.raw', status: 'active', events: 1_240_000 },
  { id: 'p2', name: 'clickhouse-etl', topic: 'events.dedup', status: 'paused', events: 890_000 },
  { id: 'p3', name: 'orders-enrich', topic: 'orders.raw', status: 'active', events: 412_000 },
]

const statusVariant: Record<DemoPipeline['status'], 'success' | 'warning' | 'error'> = {
  active: 'success',
  paused: 'warning',
  failed: 'error',
}

const pipelineColumns: DataTableColumn<DemoPipeline>[] = [
  { key: 'name', header: 'Name', width: '2fr' },
  { key: 'topic', header: 'Topic', width: '2fr' },
  {
    key: 'status',
    header: 'Status',
    width: '1fr',
    render: (p) => <Badge variant={statusVariant[p.status]}>{p.status}</Badge>,
  },
  {
    key: 'events',
    header: 'Events',
    width: '1fr',
    align: 'right',
    render: (p) => <span className="font-mono text-[var(--text-secondary)]">{p.events.toLocaleString()}</span>,
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PatternsPage() {
  return (
    <>
      <PageHeader
        title="Patterns"
        description="Composite recipes built from the primitive layer. Copy-paste, adapt, ship — but reach for an existing primitive first."
      />

      <Section
        title="Data card"
        description="Card wraps a DataTable for a self-contained reporting widget. Footer summary lives in CardContent below the table."
      >
        <DataCardPattern />
      </Section>

      <Section
        title="List with filter rail"
        description="PageShell.sidebar slot for the filter rail, body owns the search bar and table. Mirrors Library / Pipelines layouts."
      >
        <ListWithFilterRailPattern />
      </Section>

      <Section
        title="Detail header + tabs"
        description="PageShell title + breadcrumbs above tabbed content. Used by pipeline detail and library detail pages."
      >
        <DetailHeaderTabsPattern />
      </Section>

      <Section
        title="Empty state inside Card"
        description="Card variant=outline wraps an EmptyState. The dashed-border EmptyState chrome stays — Card adds the surface."
      >
        <EmptyStateInsideCardPattern />
      </Section>

      <Section
        title="Loading skeleton inside DataTable"
        description="DataTable's built-in loading state. Pass isLoading and loadingRowCount; the primitive paints skeleton rows that match the column grid."
      >
        <LoadingDataTablePattern />
      </Section>
    </>
  )
}

// ─── Pattern 1: Data card ─────────────────────────────────────────────────────

function DataCardPattern() {
  return (
    <PatternPreview>
      <Card variant="outline">
        <CardHeader className="px-5 py-4 border-b border-[var(--surface-border)]">
          <CardTitle>Active pipelines</CardTitle>
          <CardDescription className="text-[var(--text-secondary)]">Top 3 by event throughput</CardDescription>
        </CardHeader>
        <DataTable data={demoPipelines} columns={pipelineColumns} getRowId={(p) => p.id} ariaLabel="Active pipelines" />
        <CardContent className="px-5 py-3 border-t border-[var(--surface-border)] flex items-center justify-between">
          <span className="caption-1 text-[var(--text-secondary)]">Updated 2 minutes ago</span>
          <Button variant="ghost" size="sm">
            View all
          </Button>
        </CardContent>
      </Card>
      <CodeBlock
        code={`<Card variant="outline">
  <CardHeader className="px-5 py-4 border-b border-[var(--surface-border)]">
    <CardTitle>Active pipelines</CardTitle>
    <CardDescription>Top 3 by event throughput</CardDescription>
  </CardHeader>
  <DataTable data={pipelines} columns={columns} getRowId={(p) => p.id} />
  <CardContent className="px-5 py-3 border-t border-[var(--surface-border)] flex items-center justify-between">
    <span className="caption-1 text-[var(--text-secondary)]">Updated 2 minutes ago</span>
    <Button variant="ghost" size="sm">View all</Button>
  </CardContent>
</Card>`}
      />
    </PatternPreview>
  )
}

// ─── Pattern 2: List with filter rail ─────────────────────────────────────────

function ListWithFilterRailPattern() {
  const [search, setSearch] = useState('')
  const filtered = search
    ? demoPipelines.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : demoPipelines

  return (
    <PatternPreview>
      <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
        <PageShell
          title="Pipelines"
          subtitle="3 pipelines"
          sidebar={
            <div className="flex flex-col gap-1">
              <FilterRailLabel>Status</FilterRailLabel>
              <FilterRailItem active>All</FilterRailItem>
              <FilterRailItem>Active</FilterRailItem>
              <FilterRailItem>Paused</FilterRailItem>
              <FilterRailItem>Failed</FilterRailItem>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Search pipelines…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <DataTable
              data={filtered}
              columns={pipelineColumns}
              getRowId={(p) => p.id}
              ariaLabel="Filtered pipelines"
            />
          </div>
        </PageShell>
      </div>
      <CodeBlock
        code={`<PageShell
  title="Pipelines"
  subtitle={\`\${count} pipelines\`}
  sidebar={<FilterRail />}
>
  <Input placeholder="Search…" value={search} onChange={...} />
  <DataTable data={filtered} columns={columns} getRowId={...} />
</PageShell>`}
      />
    </PatternPreview>
  )
}

function FilterRailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="caption-1 font-mono uppercase tracking-wider text-[var(--text-tertiary)] px-3 mb-1.5">{children}</p>
  )
}

function FilterRailItem({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={
        'px-3 py-1.5 text-left body-3 rounded-md transition-colors ' +
        (active
          ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--interactive-hover-bg)]')
      }
    >
      {children}
    </button>
  )
}

// ─── Pattern 3: Detail header + tabs ──────────────────────────────────────────

function DetailHeaderTabsPattern() {
  return (
    <PatternPreview>
      <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
        <PageShell
          title="kafka-prod-ingest"
          subtitle="events.raw → analytics.events_clean"
          crumbs={[{ label: 'Pipelines', href: '#' }, { label: 'kafka-prod-ingest' }]}
          actions={
            <>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
              <Button variant="primary" size="sm">
                Deploy
              </Button>
            </>
          }
          status={<Badge variant="success">Running</Badge>}
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              <p className="body-3 text-[var(--text-secondary)]">
                Overview content. Throughput chart, lag panel, DLQ summary lives here.
              </p>
            </TabsContent>
            <TabsContent value="metrics" className="pt-4">
              <p className="body-3 text-[var(--text-secondary)]">Metrics tab — typically a multi-series chart.</p>
            </TabsContent>
            <TabsContent value="logs" className="pt-4">
              <p className="body-3 text-[var(--text-secondary)]">Logs tab — virtualized log viewer.</p>
            </TabsContent>
            <TabsContent value="config" className="pt-4">
              <p className="body-3 text-[var(--text-secondary)]">Config tab — YAML/JSON view + revision history.</p>
            </TabsContent>
          </Tabs>
        </PageShell>
      </div>
      <CodeBlock
        code={`<PageShell
  title={pipeline.name}
  subtitle={pipeline.route}
  crumbs={[{ label: 'Pipelines', href: '/pipelines' }, { label: pipeline.name }]}
  actions={<><Button variant="ghost">Edit</Button><Button variant="primary">Deploy</Button></>}
  status={<Badge variant={statusVariant[pipeline.status]}>{pipeline.statusLabel}</Badge>}
>
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="metrics">Metrics</TabsTrigger>
      <TabsTrigger value="logs">Logs</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">…</TabsContent>
  </Tabs>
</PageShell>`}
      />
    </PatternPreview>
  )
}

// ─── Pattern 4: Empty state inside Card ───────────────────────────────────────

function EmptyStateInsideCardPattern() {
  return (
    <PatternPreview>
      <Card variant="outline" className="p-2">
        <EmptyState
          icon={<InboxIcon size={32} strokeWidth={1.5} />}
          heading="No pipelines yet"
          copy="Pipelines you create will show up here. Saved connections become available in the wizard immediately."
          cta={{ label: 'Create pipeline', href: '#' }}
        />
      </Card>
      <CodeBlock
        code={`<Card variant="outline" className="p-2">
  <EmptyState
    icon={<InboxIcon size={32} strokeWidth={1.5} />}
    heading="No pipelines yet"
    copy="Pipelines you create will show up here."
    cta={{ label: 'Create pipeline', href: '/pipelines/create' }}
  />
</Card>`}
      />
    </PatternPreview>
  )
}

// ─── Pattern 5: Loading skeleton inside DataTable ─────────────────────────────

function LoadingDataTablePattern() {
  return (
    <PatternPreview>
      <DataTable
        data={[]}
        columns={pipelineColumns}
        getRowId={(p) => p.id}
        isLoading
        loadingRowCount={4}
        ariaLabel="Loading pipelines"
      />
      <CodeBlock
        code={`<DataTable
  data={[]}
  columns={columns}
  getRowId={(p) => p.id}
  isLoading
  loadingRowCount={4}
/>`}
      />
    </PatternPreview>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function PatternPreview({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] p-5">
      {children}
    </div>
  )
}
