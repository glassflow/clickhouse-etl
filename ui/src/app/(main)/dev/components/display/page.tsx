'use client'

import { useState } from 'react'
import { Badge } from '@/src/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/src/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/src/components/ui/avatar'
import { Button } from '@/src/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table'
import { DataTable, type DataTableColumn } from '@/src/components/ui/data-table'
import { Sparkline } from '@/src/components/ui/sparkline'
import { EmptyState } from '@/src/components/ui/empty-state'
import { Section, VariantGrid, Preview, PageHeader, CodeBlock } from '../_components/Section'

const tableData = [
  { name: 'kafka-prod-ingest', topic: 'events.raw', status: 'active', events: '1.2M' },
  { name: 'clickhouse-etl', topic: 'events.dedup', status: 'paused', events: '890K' },
  { name: 'data-transform', topic: 'events.clean', status: 'failed', events: '0' },
]

type DemoPipeline = {
  id: string
  name: string
  topic: string
  status: 'active' | 'paused' | 'failed'
  events: number
  lagMs: number
  dlq: number
  trend: number[]
}

const demoPipelines: DemoPipeline[] = [
  { id: 'p1', name: 'kafka-prod-ingest', topic: 'events.raw', status: 'active', events: 1_240_000, lagMs: 18, dlq: 0, trend: [40, 52, 48, 65, 70, 68, 74, 80, 78, 85] },
  { id: 'p2', name: 'clickhouse-etl', topic: 'events.dedup', status: 'paused', events: 890_000, lagMs: 0, dlq: 12, trend: [60, 58, 55, 50, 45, 42, 40, 38, 35, 30] },
  { id: 'p3', name: 'orders-enrich', topic: 'orders.raw', status: 'active', events: 412_000, lagMs: 240, dlq: 47, trend: [35, 38, 42, 50, 65, 78, 82, 80, 90, 100] },
  { id: 'p4', name: 'data-transform', topic: 'events.clean', status: 'failed', events: 0, lagMs: 9999, dlq: 320, trend: [80, 70, 60, 50, 40, 30, 20, 10, 5, 0] },
  { id: 'p5', name: 'session-rollup', topic: 'sessions.raw', status: 'active', events: 2_100_000, lagMs: 24, dlq: 0, trend: [60, 65, 70, 68, 75, 78, 80, 82, 85, 88] },
]

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  paused: 'warning',
  failed: 'error',
}

export default function DisplayPage() {
  return (
    <div>
      <PageHeader
        title="Display"
        description="Cards, badges, avatars, and tables for presenting structured data."
      />

      <Section title="Badge Variants" description="Use variant to communicate semantic status">
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <CodeBlock code={`<Badge variant="success">Active</Badge>
<Badge variant="warning">Paused</Badge>
<Badge variant="error">Failed</Badge>`} />
      </Section>

      <Section title="Card Variants" description="Choose variant that matches elevation and intent">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Dark Card</CardTitle>
                <CardDescription>variant="dark" — primary card surface</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Used for main content areas and pipeline configuration cards.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">dark</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="outline" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Outline Card</CardTitle>
                <CardDescription>variant="outline" — bordered container</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Lighter weight container for grouping related UI elements.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">outline</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="elevated" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Elevated Card</CardTitle>
                <CardDescription>variant="elevated" — lifted shadow</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Draws focus to important sections or selected items.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">elevated</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="feedback" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Feedback Card</CardTitle>
                <CardDescription>variant="feedback" — slate gradient border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Used for notifications, tips, and contextual feedback messages.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">feedback</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="content" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Content Card</CardTitle>
                <CardDescription>variant="content" — dark gradient + slate border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">For structured data display — pipeline steps, transformation blocks.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">content</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="elevatedSubtle" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Elevated Subtle</CardTitle>
                <CardDescription>variant="elevatedSubtle" — softer elevation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Subtle lift without the full shadow weight of elevated.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">elevatedSubtle</p>
          </div>
        </div>

        {/* Missing variants */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <Card variant="default" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Default Card</CardTitle>
                <CardDescription>variant="default" — base surface + border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Bare container — minimal visual weight.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">default</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="regular" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Regular Card</CardTitle>
                <CardDescription>variant="regular" — warm gradient border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Elevated background with brown gradient border.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">regular</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="selectable" className="p-4 cursor-pointer">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Selectable Card</CardTitle>
                <CardDescription>variant="selectable" — card-button style</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">For selection UIs — pipeline creation, template pickers.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">selectable</p>
          </div>
        </div>

        {/* State modifiers */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4 card-dark-selected">
              <p className="title-6 text-[var(--text-primary)] mb-1">Dark — Selected</p>
              <p className="body-3 text-[var(--text-secondary)]">className="card-dark-selected"</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-dark-selected</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4 card-dark-error">
              <p className="title-6 text-[var(--text-primary)] mb-1">Dark — Error</p>
              <p className="body-3 text-[var(--text-secondary)]">className="card-dark-error"</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-dark-error</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="outline" className="p-4 card-outline-selected">
              <p className="title-6 text-[var(--text-primary)] mb-1">Outline — Selected</p>
              <p className="body-3 text-[var(--text-secondary)]">className="card-outline-selected"</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-outline-selected</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="outline" className="p-4 card-outline-error">
              <p className="title-6 text-[var(--text-primary)] mb-1">Outline — Error</p>
              <p className="body-3 text-[var(--text-secondary)]">className="card-outline-error"</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-outline-error</p>
          </div>
        </div>

        <CodeBlock code={`<Card variant="dark" className="p-4">
  <CardHeader>
    <CardTitle className="title-6">Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button variant="primary">Action</Button>
  </CardFooter>
</Card>`} />
      </Section>

      <Section title="Avatar">
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col items-center gap-2">
            <Avatar>
              <AvatarFallback>GF</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">fallback</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-10">
              <AvatarFallback>VK</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">size-10</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">size-12</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>B</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>C</AvatarFallback>
              </Avatar>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">stacked</span>
          </div>
        </div>
      </Section>

      <Section title="Table" description="Use for pipeline lists, event data, and structured records">
        <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pipeline</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium text-[var(--text-primary)]">{row.name}</TableCell>
                  <TableCell className="font-mono text-[var(--text-secondary)] text-xs">{row.topic}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-[var(--text-secondary)]">{row.events}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <CodeBlock code={`<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>pipeline-1</TableCell>
      <TableCell><Badge variant="success">active</Badge></TableCell>
    </TableRow>
  </TableBody>
</Table>`} />
      </Section>

      <Section
        title="DataTable"
        description="High-level list primitive: typed columns, sortable headers, status-tinted rows, density variants, empty + loading slots. Use this for pipeline lists, library lists, and any data-dense flat-row layout."
      >
        <DataTableShowcase />
      </Section>
    </div>
  )
}

// ── DataTable showcase ──────────────────────────────────────────────

function DataTableShowcase() {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [mode, setMode] = useState<'default' | 'loading' | 'empty'>('default')

  const columns: DataTableColumn<DemoPipeline>[] = [
    {
      key: 'name',
      header: 'Pipeline',
      width: '2fr',
      sortable: true,
      render: (p) => (
        <span className="body-3 font-medium text-[var(--color-foreground-neutral)] truncate">{p.name}</span>
      ),
    },
    {
      key: 'topic',
      header: 'Source topic',
      width: '1.5fr',
      sortable: true,
      render: (p) => (
        <span className="caption-1 font-mono text-[var(--color-foreground-neutral-faded)] truncate">{p.topic}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      sortable: true,
      render: (p) => (
        <Badge variant={p.status === 'active' ? 'success' : p.status === 'paused' ? 'warning' : 'error'}>
          {p.status}
        </Badge>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      width: '1fr',
      align: 'right',
      sortable: true,
      render: (p) => (
        <span className="font-mono text-[12px] text-[var(--color-foreground-neutral)]">{formatCount(p.events)}</span>
      ),
    },
    {
      key: 'trend',
      header: 'Throughput',
      width: '1.3fr',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end">
          <Sparkline
            data={p.trend}
            width={96}
            height={20}
            stroke={
              p.status === 'failed'
                ? 'var(--color-foreground-critical)'
                : p.status === 'paused'
                  ? 'var(--color-foreground-warning)'
                  : 'var(--color-foreground-primary)'
            }
          />
        </div>
      ),
    },
    {
      key: 'dlq',
      header: 'DLQ',
      width: '0.6fr',
      align: 'right',
      sortable: true,
      render: (p) => (
        <span
          className={
            p.dlq === 0
              ? 'font-mono text-[12px] text-[var(--color-foreground-neutral-faded)]'
              : p.dlq < 50
                ? 'font-mono text-[12px] text-[var(--color-foreground-warning)]'
                : 'font-mono text-[12px] text-[var(--color-foreground-critical)]'
          }
        >
          {p.dlq}
        </span>
      ),
    },
  ]

  const rowStatus = (p: DemoPipeline) => {
    if (p.status === 'failed' || p.dlq >= 50) return 'critical' as const
    if (p.status === 'paused' || p.dlq > 0) return 'warning' as const
    return undefined
  }

  const data = mode === 'empty' ? [] : demoPipelines

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
        <span className="caption-1 font-mono text-[var(--color-foreground-neutral-faded)] uppercase tracking-widest">
          Density:
        </span>
        <Button
          variant={density === 'comfortable' ? 'primary' : 'ghostOutline'}
          size="sm"
          onClick={() => setDensity('comfortable')}
        >
          Comfortable
        </Button>
        <Button
          variant={density === 'compact' ? 'primary' : 'ghostOutline'}
          size="sm"
          onClick={() => setDensity('compact')}
        >
          Compact
        </Button>
        <div className="w-px h-5 bg-[var(--surface-border)] mx-1" />
        <span className="caption-1 font-mono text-[var(--color-foreground-neutral-faded)] uppercase tracking-widest">
          State:
        </span>
        <Button variant={mode === 'default' ? 'primary' : 'ghostOutline'} size="sm" onClick={() => setMode('default')}>
          Default
        </Button>
        <Button variant={mode === 'loading' ? 'primary' : 'ghostOutline'} size="sm" onClick={() => setMode('loading')}>
          Loading
        </Button>
        <Button variant={mode === 'empty' ? 'primary' : 'ghostOutline'} size="sm" onClick={() => setMode('empty')}>
          Empty
        </Button>
      </div>

      <DataTable<DemoPipeline>
        ariaLabel="Demo pipelines"
        data={data}
        columns={columns}
        getRowId={(p) => p.id}
        density={density}
        isLoading={mode === 'loading'}
        rowStatus={rowStatus}
        initialSortColumn="events"
        initialSortDirection="desc"
        onRowClick={(p) => console.log('row clicked:', p.id)}
        empty={
          <EmptyState
            heading="No pipelines yet"
            copy="Create your first pipeline to see it appear here."
            cta={{ label: 'Create pipeline' }}
          />
        }
      />

      <CodeBlock code={`import { DataTable, type DataTableColumn } from '@/src/components/ui/data-table'

type Pipeline = { id: string; name: string; status: string; events: number }

const columns: DataTableColumn<Pipeline>[] = [
  { key: 'name', header: 'Pipeline', width: '2fr', sortable: true,
    render: (p) => <span className="font-medium">{p.name}</span> },
  { key: 'status', header: 'Status', width: '1fr', sortable: true,
    render: (p) => <Badge variant={statusToVariant(p.status)}>{p.status}</Badge> },
  { key: 'events', header: 'Events', width: '1fr', align: 'right', sortable: true,
    render: (p) => <span className="font-mono">{formatCount(p.events)}</span> },
]

<DataTable
  data={pipelines}
  columns={columns}
  getRowId={(p) => p.id}
  density="compact"           // 'comfortable' (default) | 'compact'
  stickyHeader                // pin header on scroll
  onRowClick={(p) => router.push(\`/pipelines/\${p.id}\`)}
  rowStatus={(p) =>
    p.status === 'failed' ? 'critical' :
    p.status === 'paused' ? 'warning' : undefined
  }
  isLoading={loading}         // renders Skeleton rows
  initialSortColumn="events"
  initialSortDirection="desc"
  empty={<EmptyState heading="No pipelines yet" copy="..." />}
  ariaLabel="Pipelines"
/>`} />
    </div>
  )
}
