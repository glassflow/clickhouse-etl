# Library UI Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the visual and functional gap between the current library module implementation and the HTML design handover artboards (artboards1.jsx, artboards2.jsx, library-detail-artboards.jsx).

**Architecture:** Extend existing types non-breakingly (defaulted fields), redesign ConnectionDetail and SchemaDetail to 2fr/1fr grids with kv-rows, add Dedup and Filter config sections end-to-end (types → seed → mock routes → list component → detail component → page route).

**Tech Stack:** Next.js 15 App Router, React 19, Vitest + Testing Library, Tailwind layout + CSS token design system, pnpm.

---

## File Map

### Modified files
- `src/hooks/useLibraryDetail.ts` — extend `UsedByEntry` with `health`, `status`, `drift`
- `src/hooks/useLibraryConnections.ts` — extend `LibrarySchema` with `latestVersion`, `hasDrift`, `usedByCount`; add `LibraryDedupConfig`, `LibraryFilterConfig`, `LibraryFilterRule`, `LibraryFilterRuleGroup` types; add `useLibraryDedupConfigs`, `useLibraryFilterConfigs` hooks
- `src/app/ui-api/mock/data/library.ts` — add `hasDrift`, `latestVersion` to mock schemas; add `health/status/drift` to mock used-by entries; add `mockDedupConfigs`, `mockFilterConfigs` seed arrays
- `src/app/ui-api/mock/data/library-state.ts` — add dedup/filter Maps and CRUD helpers
- `src/modules/library/components/ConnectionDetail.tsx` — full redesign (kv-rows + 2fr/1fr grid)
- `src/modules/library/components/SchemaDetail.tsx` — layout redesign (2fr/1fr, swap main/sidebar)
- `src/modules/library/components/SchemaList.tsx` — add source filter chips, version badge, drift indicator
- `src/modules/library/components/LibraryClient.tsx` — wire in DedupConfigsList + FilterConfigsList sections

### New files
- `src/app/ui-api/mock/library/dedup/route.ts` — GET list
- `src/app/ui-api/mock/library/dedup/[id]/route.ts` — GET/PATCH/DELETE
- `src/app/ui-api/mock/library/filter/route.ts` — GET list
- `src/app/ui-api/mock/library/filter/[id]/route.ts` — GET/PATCH/DELETE
- `src/modules/library/components/DedupConfigsList.tsx`
- `src/modules/library/components/DedupConfigDetail.tsx`
- `src/modules/library/components/FilterConfigsList.tsx`
- `src/modules/library/components/FilterConfigDetail.tsx`
- `src/app/(shell)/library/dedup/[id]/page.tsx`
- `src/app/(shell)/library/filter/[id]/page.tsx`

---

### Task 1: Extend UsedByEntry + mock seed data

**Files:**
- Modify: `src/hooks/useLibraryDetail.ts`
- Modify: `src/app/ui-api/mock/data/library.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useLibraryDetail.test.ts
import { describe, it, expect } from 'vitest'
import type { UsedByEntry } from './useLibraryDetail'

describe('UsedByEntry type shape', () => {
  it('has health, status, drift fields', () => {
    const entry: UsedByEntry = {
      pipelineId: 'p1',
      pipelineName: 'My Pipeline',
      pinnedVersion: 'v2',
      health: 'ok',
      status: 'active',
      drift: false,
    }
    expect(entry.health).toBe('ok')
    expect(entry.status).toBe('active')
    expect(entry.drift).toBe(false)
  })

  it('allows warn/err/stopped variants', () => {
    const e: UsedByEntry = {
      pipelineId: 'p2',
      pipelineName: 'Broken',
      health: 'err',
      status: 'stopped',
      drift: true,
    }
    expect(e.health).toBe('err')
    expect(e.drift).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui
pnpm vitest run src/hooks/useLibraryDetail.test.ts
```
Expected: FAIL — "health does not exist on type UsedByEntry"

- [ ] **Step 3: Extend UsedByEntry in `src/hooks/useLibraryDetail.ts`**

Find the `UsedByEntry` type and replace it:
```ts
export type UsedByEntry = {
  pipelineId: string
  pipelineName: string
  pinnedVersion?: string
  health: 'ok' | 'warn' | 'err'
  status: 'active' | 'stopped'
  drift: boolean
}
```

- [ ] **Step 4: Update mock seed data in `src/app/ui-api/mock/data/library.ts`**

Find every `MockUsedByEntry` literal in the file (search for `pipelineId:`) and add the three new fields. Example — each entry should look like:
```ts
{ pipelineId: 'pipe-1', pipelineName: 'Prod ingest', pinnedVersion: 'v2', health: 'ok', status: 'active', drift: false },
{ pipelineId: 'pipe-2', pipelineName: 'Staging mirror', health: 'warn', status: 'active', drift: true },
{ pipelineId: 'pipe-3', pipelineName: 'Archive sink', pinnedVersion: 'v1', health: 'err', status: 'stopped', drift: false },
```

Apply similar changes to every usedBy array in the file (connections, schemas, etc.).

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run src/hooks/useLibraryDetail.test.ts
```
Expected: PASS

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
pnpm vitest run
```
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useLibraryDetail.ts src/app/ui-api/mock/data/library.ts src/hooks/useLibraryDetail.test.ts
git commit -m "feat(library): extend UsedByEntry with health/status/drift fields"
```

---

### Task 2: Extend LibrarySchema type + mock data

**Files:**
- Modify: `src/hooks/useLibraryConnections.ts`
- Modify: `src/app/ui-api/mock/data/library.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useLibraryConnections.test.ts (add to existing or create)
import { describe, it, expect } from 'vitest'
import type { LibrarySchema } from './useLibraryConnections'

describe('LibrarySchema type shape', () => {
  it('has latestVersion, hasDrift, usedByCount', () => {
    const s: LibrarySchema = {
      id: 's1', name: 'events', description: null,
      folderId: null, tags: [],
      source: 'kafka', registryUrl: null,
      fields: [], fieldCount: 3,
      pipelineCount: 2, createdAt: '', updatedAt: '',
      latestVersion: 'v3',
      hasDrift: false,
      usedByCount: 2,
    }
    expect(s.latestVersion).toBe('v3')
    expect(s.hasDrift).toBe(false)
    expect(s.usedByCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/hooks/useLibraryConnections.test.ts
```
Expected: FAIL — missing fields on type

- [ ] **Step 3: Extend LibrarySchema in `src/hooks/useLibraryConnections.ts`**

Find the `LibrarySchema` interface and add:
```ts
  latestVersion: string | null
  hasDrift: boolean
  usedByCount: number
```

- [ ] **Step 4: Update mock schemas in `src/app/ui-api/mock/data/library.ts`**

Find each object in the `mockSchemas` array and add the new fields:
```ts
latestVersion: 'v3',
hasDrift: false,
usedByCount: 2,
```
Give at least one schema `hasDrift: true` so the drift indicator has something to render.

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/hooks/useLibraryConnections.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useLibraryConnections.ts src/app/ui-api/mock/data/library.ts src/hooks/useLibraryConnections.test.ts
git commit -m "feat(library): extend LibrarySchema with latestVersion/hasDrift/usedByCount"
```

---

### Task 3: ConnectionDetail redesign — 2fr/1fr kv-row layout

**Files:**
- Modify: `src/modules/library/components/ConnectionDetail.tsx`

**Design reference (A6 Kafka, A7 ClickHouse from artboards2.jsx):**
- Left column (2fr): connection config as kv-rows + used-by pills grid
- Right column (1fr): health panel + metadata panel + danger zone panel

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/library/components/ConnectionDetail.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionDetail } from './ConnectionDetail'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

const mockConn: LibraryConnection = {
  id: 'c1', kind: 'kafka', name: 'Prod Kafka',
  description: 'Main cluster', folderId: null, tags: [],
  config: { bootstrapServers: 'kafka:9092', authMethod: 'sasl_plain', username: 'user', password: 'secret' },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Ingest', health: 'ok', status: 'active', drift: false },
]

describe('ConnectionDetail', () => {
  it('renders connection name as heading', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prod Kafka')
  })

  it('shows bootstrapServers as a kv-row label', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Bootstrap servers/i)).toBeInTheDocument()
  })

  it('masks password field', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText(/••••/)).toBeInTheDocument()
  })

  it('renders used-by pill for each pipeline', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText('Ingest')).toBeInTheDocument()
  })

  it('renders Health panel', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Health/i)).toBeInTheDocument()
  })

  it('renders Danger zone section', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })

  it('does NOT render a raw JSON pre block', () => {
    const { container } = render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(container.querySelector('pre')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/ConnectionDetail.test.tsx
```
Expected: FAIL — multiple assertions failing (pre exists, no kv-rows, etc.)

- [ ] **Step 3: Rewrite ConnectionDetail**

Replace the full content of `src/modules/library/components/ConnectionDetail.tsx` with:

```tsx
'use client'
import { ArrowLeftIcon, ServerIcon, DatabaseIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { TypeGlyph } from '@/src/components/common/TypeGlyph'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

const PASSWORD_KEYS = new Set(['password', 'secret', 'token', 'apiKey', 'api_key'])

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--surface-border)] last:border-0">
      <span className="body-3 text-[var(--text-secondary)] w-40 shrink-0">{label}</span>
      <span className="body-3 text-[var(--text-primary)] font-mono break-all">{value}</span>
    </div>
  )
}

function maskValue(key: string, value: unknown): string {
  if (PASSWORD_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
    return '••••••••'
  }
  return String(value ?? '—')
}

function configLabel(key: string): string {
  const labels: Record<string, string> = {
    bootstrapServers: 'Bootstrap servers',
    authMethod: 'Auth method',
    username: 'Username',
    password: 'Password',
    host: 'Host',
    port: 'Port',
    database: 'Database',
    username_ch: 'Username',
    password_ch: 'Password',
    secure: 'TLS / secure',
  }
  return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function UsedByPill({ entry }: { entry: UsedByEntry }) {
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
      <Badge variant={colorMap[entry.health]} className="w-2 h-2 p-0 rounded-full" />
      <span className="body-3 text-[var(--text-primary)]">{entry.pipelineName}</span>
      {entry.drift && (
        <span className="caption-1 text-[var(--color-yellow-500)]">drift</span>
      )}
    </div>
  )
}

type Props = {
  connection: LibraryConnection
  usedBy: UsedByEntry[]
}

export function ConnectionDetail({ connection, usedBy }: Props) {
  const router = useRouter()
  const configEntries = Object.entries(connection.config ?? {})

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <TypeGlyph kind={connection.kind} size={20} />
        <h1 className="title-4 text-[var(--text-primary)]">{connection.name}</h1>
        <Badge variant="secondary" className="capitalize">{connection.kind}</Badge>
        {connection.description && (
          <span className="body-3 text-[var(--text-secondary)]">{connection.description}</span>
        )}
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left: config + used-by */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Connection</h2>
            <div>
              {configEntries.map(([k, v]) => (
                <KVRow key={k} label={configLabel(k)} value={maskValue(k, v)} />
              ))}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && (
                <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length} pipeline{usedBy.length !== 1 ? 's' : ''}</span>
              )}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {usedBy.map(e => <UsedByPill key={e.pipelineId} entry={e} />)}
              </div>
            )}
          </Card>
        </div>

        {/* Right: health + metadata + danger */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Health</h2>
            <div className="flex items-center gap-2">
              <Badge variant="success">Reachable</Badge>
              <span className="caption-1 text-[var(--text-secondary)]">Last checked just now</span>
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <KVRow label="Created" value={new Date(connection.createdAt).toLocaleDateString()} />
            <KVRow label="Updated" value={new Date(connection.updatedAt).toLocaleDateString()} />
            {connection.tags.length > 0 && (
              <div className="flex items-start gap-4 py-2.5">
                <span className="body-3 text-[var(--text-secondary)] w-40 shrink-0">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {connection.tags.map(t => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this connection will remove it from all pipelines that use it.
            </p>
            <Button variant="destructive" size="sm">Delete connection</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/modules/library/components/ConnectionDetail.test.tsx
```
Expected: PASS (7 tests)

- [ ] **Step 5: Run full suite**

```bash
pnpm vitest run
```
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/modules/library/components/ConnectionDetail.tsx src/modules/library/components/ConnectionDetail.test.tsx
git commit -m "feat(library): redesign ConnectionDetail with 2fr/1fr kv-row layout"
```

---

### Task 4: SchemaDetail layout redesign — 2fr/1fr, fields table main

**Files:**
- Modify: `src/modules/library/components/SchemaDetail.tsx`

**Design reference (A2 from artboards1.jsx):**
- Left (2fr): fields table (name/type/nullable/description) + used-by rich table
- Right (1fr): metadata kv + version history timeline + danger zone

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/library/components/SchemaDetail.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SchemaDetail } from './SchemaDetail'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

const mockSchema: LibrarySchema = {
  id: 's1', name: 'events', description: 'Event schema',
  folderId: null, tags: [], source: 'kafka', registryUrl: null,
  fields: [
    { name: 'id', type: 'string', nullable: false, description: 'Primary key' },
    { name: 'ts', type: 'long', nullable: false, description: 'Timestamp' },
  ],
  fieldCount: 2, pipelineCount: 1,
  latestVersion: 'v3', hasDrift: false, usedByCount: 1,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Ingest', health: 'ok', status: 'active', drift: false },
]

describe('SchemaDetail', () => {
  it('renders schema name heading', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('events')
  })

  it('renders fields table with column headers', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('Field')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Nullable')).toBeInTheDocument()
  })

  it('renders each field row', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('ts')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
  })

  it('renders used-by section in main column', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('Ingest')).toBeInTheDocument()
  })

  it('renders version badge in sidebar', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('v3')).toBeInTheDocument()
  })

  it('renders Danger zone in sidebar', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/SchemaDetail.test.tsx
```
Expected: FAIL — layout wrong, missing fields table, etc.

- [ ] **Step 3: Rewrite SchemaDetail**

Replace the full content of `src/modules/library/components/SchemaDetail.tsx`:

```tsx
'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { SchemaVersionTimeline } from './SchemaVersionTimeline'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function UsedByRow({ entry }: { entry: UsedByEntry }) {
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const
  return (
    <tr className="border-b border-[var(--surface-border)] last:border-0">
      <td className="py-2.5 pr-4">
        <span className="body-3 text-[var(--text-primary)]">{entry.pipelineName}</span>
      </td>
      <td className="py-2.5 pr-4">
        {entry.pinnedVersion
          ? <Badge variant="secondary">{entry.pinnedVersion}</Badge>
          : <span className="caption-1 text-[var(--text-secondary)]">latest</span>
        }
      </td>
      <td className="py-2.5 pr-4">
        <Badge variant={colorMap[entry.health]}>{entry.status}</Badge>
      </td>
      <td className="py-2.5">
        {entry.drift && <Badge variant="warning">drift</Badge>}
      </td>
    </tr>
  )
}

type Props = {
  schema: LibrarySchema
  usedBy: UsedByEntry[]
}

export function SchemaDetail({ schema, usedBy }: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <h1 className="title-4 text-[var(--text-primary)]">{schema.name}</h1>
        {schema.latestVersion && <Badge variant="secondary">{schema.latestVersion}</Badge>}
        {schema.hasDrift && <Badge variant="warning">drift</Badge>}
        <Badge variant="outline" className="capitalize">{schema.source}</Badge>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left: fields table + used-by table */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Fields
              <span className="ml-2 caption-1 text-[var(--text-secondary)]">{schema.fieldCount}</span>
            </h2>
            {schema.fields.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">No fields defined.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Field</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Type</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Nullable</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.fields.map(f => (
                    <tr key={f.name} className="border-b border-[var(--surface-border)] last:border-0">
                      <td className="py-2.5 pr-4 font-mono body-3 text-[var(--text-primary)]">{f.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary">{f.type}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 body-3 text-[var(--text-secondary)]">
                        {f.nullable ? 'yes' : 'no'}
                      </td>
                      <td className="py-2.5 body-3 text-[var(--text-secondary)]">{f.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && (
                <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length}</span>
              )}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Pipeline</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Version</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Status</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2">Drift</th>
                  </tr>
                </thead>
                <tbody>
                  {usedBy.map(e => <UsedByRow key={e.pipelineId} entry={e} />)}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right: metadata + version timeline + danger */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <div className="flex flex-col">
              {[
                ['Source', schema.source],
                ['Created', new Date(schema.createdAt).toLocaleDateString()],
                ['Updated', new Date(schema.updatedAt).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-4 py-2 border-b border-[var(--surface-border)] last:border-0">
                  <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
                  <span className="body-3 text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
              {schema.tags.length > 0 && (
                <div className="flex items-start gap-4 py-2">
                  <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {schema.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Version history</h2>
            <SchemaVersionTimeline schemaId={schema.id} />
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this schema will remove it from all pipelines that reference it.
            </p>
            <Button variant="destructive" size="sm">Delete schema</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/modules/library/components/SchemaDetail.test.tsx
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/library/components/SchemaDetail.tsx src/modules/library/components/SchemaDetail.test.tsx
git commit -m "feat(library): redesign SchemaDetail with 2fr/1fr layout and fields table"
```

---

### Task 5: SchemaList — source filter chips, version badge, drift indicator

**Files:**
- Modify: `src/modules/library/components/SchemaList.tsx`

**Design reference (A1 from artboards1.jsx):**
- Filter chips row: All / Kafka / OTLP / Manual (+ Any usage / Used / Unused)
- Each card: version badge bottom-right, orange drift dot on card border when hasDrift

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/library/components/SchemaList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaList } from './SchemaList'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'

const base: LibrarySchema = {
  id: 's1', name: 'events', description: null,
  folderId: null, tags: [], source: 'kafka', registryUrl: null,
  fields: [], fieldCount: 3, pipelineCount: 2,
  latestVersion: 'v2', hasDrift: false, usedByCount: 2,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
}
const drifted: LibrarySchema = { ...base, id: 's2', name: 'metrics', source: 'otlp', hasDrift: true, latestVersion: 'v1' }
const manual: LibrarySchema = { ...base, id: 's3', name: 'manual_cfg', source: 'manual' }

describe('SchemaList', () => {
  it('renders source filter chips', () => {
    render(<SchemaList schemas={[base]} />)
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kafka/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OTLP/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manual/i })).toBeInTheDocument()
  })

  it('shows version badge on each card', () => {
    render(<SchemaList schemas={[base]} />)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('shows drift indicator on drifted schema card', () => {
    const { container } = render(<SchemaList schemas={[drifted]} />)
    expect(container.querySelector('.schema-card-drift')).not.toBeNull()
  })

  it('filters schemas by source chip click', async () => {
    render(<SchemaList schemas={[base, drifted, manual]} />)
    await userEvent.click(screen.getByRole('button', { name: /OTLP/i }))
    expect(screen.getByText('metrics')).toBeInTheDocument()
    expect(screen.queryByText('events')).not.toBeInTheDocument()
    expect(screen.queryByText('manual_cfg')).not.toBeInTheDocument()
  })

  it('shows all schemas when All chip is active', async () => {
    render(<SchemaList schemas={[base, drifted, manual]} />)
    await userEvent.click(screen.getByRole('button', { name: /OTLP/i }))
    await userEvent.click(screen.getByRole('button', { name: /All/i }))
    expect(screen.getByText('events')).toBeInTheDocument()
    expect(screen.getByText('metrics')).toBeInTheDocument()
    expect(screen.getByText('manual_cfg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/SchemaList.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Update SchemaList**

Open `src/modules/library/components/SchemaList.tsx`. Add source filter chip state and update each card to include version badge and drift class. Key changes:

```tsx
// Add near top of component
const [sourceFilter, setSourceFilter] = useState<'all' | 'kafka' | 'otlp' | 'manual'>('all')

const SOURCE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'kafka', label: 'Kafka' },
  { key: 'otlp', label: 'OTLP' },
  { key: 'manual', label: 'Manual' },
] as const

// Filter schemas by source
const filtered = sourceFilter === 'all'
  ? schemas
  : schemas.filter(s => s.source === sourceFilter)

// Add filter chip row above card grid:
<div className="flex items-center gap-2 mb-4">
  {SOURCE_CHIPS.map(c => (
    <button
      key={c.key}
      onClick={() => setSourceFilter(c.key)}
      className={`chip ${sourceFilter === c.key ? 'chip-active' : ''}`}
    >
      {c.label}
    </button>
  ))}
</div>

// In each card wrapper, add drift class:
<div
  key={schema.id}
  className={`...existing classes... ${schema.hasDrift ? 'schema-card-drift' : ''}`}
>
  ...
  {/* version badge inside card */}
  {schema.latestVersion && (
    <Badge variant="secondary" className="ml-auto">{schema.latestVersion}</Badge>
  )}
</div>
```

Add the `.schema-card-drift` class to `src/app/styles/dashboard.css` (or the library CSS file if it exists):
```css
.schema-card-drift {
  border-color: var(--color-yellow-600) !important;
}
```

Also update the iteration to use `filtered` instead of `schemas`.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/modules/library/components/SchemaList.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/library/components/SchemaList.tsx src/modules/library/components/SchemaList.test.tsx
git commit -m "feat(library): add source filter chips, version badge, drift indicator to SchemaList"
```

---

### Task 6: Dedup config types + mock seed + state helpers

**Files:**
- Modify: `src/hooks/useLibraryConnections.ts`
- Modify: `src/app/ui-api/mock/data/library.ts`
- Modify: `src/app/ui-api/mock/data/library-state.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/ui-api/mock/data/library-state.test.ts (add to existing or create)
import { describe, it, expect, beforeEach } from 'vitest'
import { listDedupConfigs, getDedupConfig } from './library-state'

describe('DedupConfig state', () => {
  it('listDedupConfigs returns at least 2 items', () => {
    const items = listDedupConfigs()
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('getDedupConfig returns item by id', () => {
    const items = listDedupConfigs()
    const first = items[0]
    expect(getDedupConfig(first.id)).toEqual(first)
  })

  it('getDedupConfig returns undefined for unknown id', () => {
    expect(getDedupConfig('nonexistent')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/app/ui-api/mock/data/library-state.test.ts
```
Expected: FAIL — listDedupConfigs not exported

- [ ] **Step 3: Add LibraryDedupConfig type to `src/hooks/useLibraryConnections.ts`**

Add after the existing `LibrarySchema` interface:
```ts
export interface LibraryDedupConfig {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  keyFields: string[]
  secondaryKeyFields: string[]
  windowDuration: string
  windowType: 'tumbling' | 'sliding'
  timeAttribute: 'event_time' | 'processing_time'
  onDuplicate: 'keep_first' | 'keep_last'
  lateEventPolicy: 'pass_through' | 'drop'
  stateBackend: 'nats-kv' | 'memory'
  latestVersion: string
  usedByCount: number
  hasDrift: boolean
  createdAt: string
  updatedAt: string
}
```

Also add the hook (near the existing `useLibrarySchemas`):
```ts
export function useLibraryDedupConfigs() {
  return useLibraryFetch<LibraryDedupConfig[]>('/ui-api/library/dedup')
}
```

- [ ] **Step 4: Add mock seed data to `src/app/ui-api/mock/data/library.ts`**

Add after the existing mockSchemas array:
```ts
export const mockDedupConfigs: MockDedupConfig[] = [
  {
    id: 'dedup-1',
    name: 'Order event dedup',
    description: 'Removes duplicate order events within a 10-minute window',
    folderId: null,
    tags: ['production', 'orders'],
    keyFields: ['orderId'],
    secondaryKeyFields: ['eventType'],
    windowDuration: '10m',
    windowType: 'tumbling',
    timeAttribute: 'event_time',
    onDuplicate: 'keep_first',
    lateEventPolicy: 'pass_through',
    stateBackend: 'nats-kv',
    latestVersion: 'v2',
    usedByCount: 3,
    hasDrift: false,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-04-20T14:30:00Z',
  },
  {
    id: 'dedup-2',
    name: 'Click stream dedup',
    description: 'Session-level click deduplication',
    folderId: null,
    tags: ['analytics'],
    keyFields: ['sessionId', 'clickId'],
    secondaryKeyFields: [],
    windowDuration: '5m',
    windowType: 'sliding',
    timeAttribute: 'processing_time',
    onDuplicate: 'keep_last',
    lateEventPolicy: 'drop',
    stateBackend: 'memory',
    latestVersion: 'v1',
    usedByCount: 1,
    hasDrift: true,
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-05-01T11:00:00Z',
  },
]

export type MockDedupConfig = {
  id: string; name: string; description: string | null
  folderId: string | null; tags: string[]
  keyFields: string[]; secondaryKeyFields: string[]
  windowDuration: string; windowType: 'tumbling' | 'sliding'
  timeAttribute: 'event_time' | 'processing_time'
  onDuplicate: 'keep_first' | 'keep_last'
  lateEventPolicy: 'pass_through' | 'drop'
  stateBackend: 'nats-kv' | 'memory'
  latestVersion: string; usedByCount: number; hasDrift: boolean
  createdAt: string; updatedAt: string
}
```

- [ ] **Step 5: Add dedup state helpers to `src/app/ui-api/mock/data/library-state.ts`**

Add after the existing schemas Map:
```ts
import { mockDedupConfigs, type MockDedupConfig } from './library'

const dedupConfigs = new Map<string, MockDedupConfig>()

function initDedupConfigs() {
  mockDedupConfigs.forEach(d => dedupConfigs.set(d.id, { ...d }))
}
initDedupConfigs()

export function listDedupConfigs(): MockDedupConfig[] {
  return Array.from(dedupConfigs.values())
}

export function getDedupConfig(id: string): MockDedupConfig | undefined {
  return dedupConfigs.get(id)
}

export function updateDedupConfig(id: string, patch: Partial<MockDedupConfig>): MockDedupConfig | null {
  const existing = dedupConfigs.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  dedupConfigs.set(id, updated)
  return updated
}

export function deleteDedupConfig(id: string): boolean {
  return dedupConfigs.delete(id)
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm vitest run src/app/ui-api/mock/data/library-state.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useLibraryConnections.ts src/app/ui-api/mock/data/library.ts src/app/ui-api/mock/data/library-state.ts src/app/ui-api/mock/data/library-state.test.ts
git commit -m "feat(library): add LibraryDedupConfig type, mock seed data, and state helpers"
```

---

### Task 7: Dedup mock API routes

**Files:**
- Create: `src/app/ui-api/mock/library/dedup/route.ts`
- Create: `src/app/ui-api/mock/library/dedup/[id]/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/ui-api/mock/library/dedup/route.test.ts
import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /ui-api/mock/library/dedup', () => {
  it('returns a list of dedup configs', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(2)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('keyFields')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/app/ui-api/mock/library/dedup/route.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create list route**

Create `src/app/ui-api/mock/library/dedup/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { listDedupConfigs } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listDedupConfigs())
}
```

- [ ] **Step 4: Create detail route**

Create `src/app/ui-api/mock/library/dedup/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getDedupConfig, updateDedupConfig, deleteDedupConfig } from '@/src/app/ui-api/mock/data/library-state'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const item = getDedupConfig(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const patch = await req.json()
  const updated = updateDedupConfig(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const deleted = deleteDedupConfig(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/app/ui-api/mock/library/dedup/route.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/ui-api/mock/library/dedup/route.ts src/app/ui-api/mock/library/dedup/[id]/route.ts src/app/ui-api/mock/library/dedup/route.test.ts
git commit -m "feat(library): add mock API routes for dedup configs"
```

---

### Task 8: DedupConfigsList + LibraryClient wiring

**Files:**
- Create: `src/modules/library/components/DedupConfigsList.tsx`
- Modify: `src/modules/library/components/LibraryClient.tsx`

**Design reference (L1 from library-detail-artboards.jsx card grid):**
- Cards: name + window type chip + key fields pills + version badge + drift indicator + used-by count
- Similar pattern to ConnectionsList

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/library/components/DedupConfigsList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DedupConfigsList } from './DedupConfigsList'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'

const mockConfigs: LibraryDedupConfig[] = [
  {
    id: 'dedup-1', name: 'Order dedup', description: null,
    folderId: null, tags: [],
    keyFields: ['orderId'], secondaryKeyFields: [],
    windowDuration: '10m', windowType: 'tumbling',
    timeAttribute: 'event_time', onDuplicate: 'keep_first',
    lateEventPolicy: 'pass_through', stateBackend: 'nats-kv',
    latestVersion: 'v2', usedByCount: 3, hasDrift: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'dedup-2', name: 'Click dedup', description: null,
    folderId: null, tags: [],
    keyFields: ['sessionId'], secondaryKeyFields: [],
    windowDuration: '5m', windowType: 'sliding',
    timeAttribute: 'processing_time', onDuplicate: 'keep_last',
    lateEventPolicy: 'drop', stateBackend: 'memory',
    latestVersion: 'v1', usedByCount: 1, hasDrift: true,
    createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

describe('DedupConfigsList', () => {
  it('renders a card for each config', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('Order dedup')).toBeInTheDocument()
    expect(screen.getByText('Click dedup')).toBeInTheDocument()
  })

  it('shows version badge', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('shows window type chip', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('tumbling')).toBeInTheDocument()
    expect(screen.getByText('sliding')).toBeInTheDocument()
  })

  it('shows drift indicator for drifted config', () => {
    const { container } = render(<DedupConfigsList configs={mockConfigs} />)
    expect(container.querySelector('.schema-card-drift')).not.toBeNull()
  })

  it('each card is a link to /library/dedup/[id]', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/library/dedup/dedup-1')).toBe(true)
  })

  it('renders empty state when no configs', () => {
    render(<DedupConfigsList configs={[]} />)
    expect(screen.getByText(/No dedup configs/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/DedupConfigsList.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create DedupConfigsList**

Create `src/modules/library/components/DedupConfigsList.tsx`:
```tsx
import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'

type Props = { configs: LibraryDedupConfig[] }

export function DedupConfigsList({ configs }: Props) {
  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="body-3 text-[var(--text-secondary)]">No dedup configs yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {configs.map(cfg => (
        <Link key={cfg.id} href={`/library/dedup/${cfg.id}`} className="block">
          <Card
            variant="dark"
            className={`p-4 h-full hover:border-[var(--surface-border-hover)] transition-colors ${cfg.hasDrift ? 'schema-card-drift' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="title-6 text-[var(--text-primary)] truncate">{cfg.name}</span>
              <Badge variant="secondary">{cfg.latestVersion}</Badge>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">{cfg.windowType}</Badge>
              <Badge variant="outline">{cfg.windowDuration}</Badge>
              {cfg.hasDrift && <Badge variant="warning">drift</Badge>}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {cfg.keyFields.map(k => (
                <span key={k} className="font-mono caption-1 px-1.5 py-0.5 rounded bg-[var(--surface-bg)] text-[var(--text-secondary)]">{k}</span>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <span className="caption-1 text-[var(--text-secondary)]">
                {cfg.usedByCount} pipeline{cfg.usedByCount !== 1 ? 's' : ''}
              </span>
              <span className="caption-1 text-[var(--text-secondary)]">
                {new Date(cfg.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Wire DedupConfigsList into LibraryClient**

In `src/modules/library/components/LibraryClient.tsx`:
1. Import `DedupConfigsList` and `useLibraryDedupConfigs`
2. Call the hook at the top of the component
3. Replace the "dedup" section's `EmptyState` stub with `<DedupConfigsList configs={dedupConfigs ?? []} />`

```tsx
// Add import
import { DedupConfigsList } from './DedupConfigsList'
import { useLibraryDedupConfigs } from '@/src/hooks/useLibraryConnections'

// Add hook call inside component
const { data: dedupConfigs, isLoading: dedupLoading } = useLibraryDedupConfigs()

// Replace the dedup section rendering:
case 'dedup':
  return dedupLoading
    ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{/* skeleton */}</div>
    : <DedupConfigsList configs={dedupConfigs ?? []} />
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/modules/library/components/DedupConfigsList.test.tsx
```
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/library/components/DedupConfigsList.tsx src/modules/library/components/DedupConfigsList.test.tsx src/modules/library/components/LibraryClient.tsx
git commit -m "feat(library): add DedupConfigsList component and wire into LibraryClient"
```

---

### Task 9: DedupConfigDetail component + page route

**Files:**
- Create: `src/modules/library/components/DedupConfigDetail.tsx`
- Create: `src/app/(shell)/library/dedup/[id]/page.tsx`

**Design reference (L1 from library-detail-artboards.jsx):**
- Left (2fr): config kv-rows + window visualization + YAML preview + used-by
- Right (1fr): version timeline + metadata + danger zone

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/library/components/DedupConfigDetail.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DedupConfigDetail } from './DedupConfigDetail'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

const mockConfig: LibraryDedupConfig = {
  id: 'dedup-1', name: 'Order dedup', description: 'Removes duplicate orders',
  folderId: null, tags: ['production'],
  keyFields: ['orderId'], secondaryKeyFields: [],
  windowDuration: '10m', windowType: 'tumbling',
  timeAttribute: 'event_time', onDuplicate: 'keep_first',
  lateEventPolicy: 'pass_through', stateBackend: 'nats-kv',
  latestVersion: 'v2', usedByCount: 2, hasDrift: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Prod ingest', health: 'ok', status: 'active', drift: false },
]

describe('DedupConfigDetail', () => {
  it('renders config name as heading', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order dedup')
  })

  it('shows key fields', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText('orderId')).toBeInTheDocument()
  })

  it('shows window type and duration kv-rows', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Window type/i)).toBeInTheDocument()
    expect(screen.getByText('tumbling')).toBeInTheDocument()
    expect(screen.getByText('10m')).toBeInTheDocument()
  })

  it('shows used-by pipeline', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText('Prod ingest')).toBeInTheDocument()
  })

  it('shows Danger zone', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/DedupConfigDetail.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create DedupConfigDetail**

Create `src/modules/library/components/DedupConfigDetail.tsx`:
```tsx
'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--surface-border)] last:border-0">
      <span className="body-3 text-[var(--text-secondary)] w-44 shrink-0">{label}</span>
      <span className="body-3 text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

type Props = {
  config: LibraryDedupConfig
  usedBy: UsedByEntry[]
}

export function DedupConfigDetail({ config, usedBy }: Props) {
  const router = useRouter()
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <h1 className="title-4 text-[var(--text-primary)]">{config.name}</h1>
        <Badge variant="secondary">{config.latestVersion}</Badge>
        {config.hasDrift && <Badge variant="warning">drift</Badge>}
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left: config kv-rows + key fields + used-by */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Configuration</h2>
            <KVRow label="Window type" value={config.windowType} />
            <KVRow label="Window duration" value={config.windowDuration} />
            <KVRow label="Time attribute" value={config.timeAttribute.replace('_', ' ')} />
            <KVRow label="On duplicate" value={config.onDuplicate.replace('_', ' ')} />
            <KVRow label="Late event policy" value={config.lateEventPolicy.replace('_', ' ')} />
            <KVRow label="State backend" value={config.stateBackend} />
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Key fields</h2>
            <div className="flex flex-wrap gap-2">
              {config.keyFields.map(k => (
                <span key={k} className="font-mono body-3 px-2 py-1 rounded bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-primary)]">{k}</span>
              ))}
              {config.secondaryKeyFields.length > 0 && (
                <>
                  <span className="body-3 text-[var(--text-secondary)]">secondary:</span>
                  {config.secondaryKeyFields.map(k => (
                    <span key={k} className="font-mono body-3 px-2 py-1 rounded bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-secondary)]">{k}</span>
                  ))}
                </>
              )}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length}</span>}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {usedBy.map(e => (
                  <div key={e.pipelineId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                    <Badge variant={colorMap[e.health]} className="w-2 h-2 p-0 rounded-full" />
                    <span className="body-3 text-[var(--text-primary)]">{e.pipelineName}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: metadata + danger */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <KVRow label="Created" value={new Date(config.createdAt).toLocaleDateString()} />
            <KVRow label="Updated" value={new Date(config.updatedAt).toLocaleDateString()} />
            {config.tags.length > 0 && (
              <div className="flex items-start gap-4 py-2">
                <span className="body-3 text-[var(--text-secondary)] w-44 shrink-0">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {config.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            )}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this config will remove it from all pipelines that use it.
            </p>
            <Button variant="destructive" size="sm">Delete config</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the page route**

Create `src/app/(shell)/library/dedup/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getApiUrl } from '@/src/utils/mock-api'
import { DedupConfigDetail } from '@/src/modules/library/components/DedupConfigDetail'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ id: string }> }

export default async function DedupConfigPage({ params }: Props) {
  const { id } = await params

  let config: LibraryDedupConfig
  let usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getDedupConfig } = await import('@/src/app/ui-api/mock/data/library-state')
    const found = getDedupConfig(id)
    if (!found) notFound()
    config = found as LibraryDedupConfig
  } else {
    const res = await fetch(getApiUrl(`library/dedup/${id}`), { cache: 'no-store' })
    if (!res.ok) notFound()
    config = await res.json()
  }

  return <DedupConfigDetail config={config} usedBy={usedBy} />
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/modules/library/components/DedupConfigDetail.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/library/components/DedupConfigDetail.tsx src/modules/library/components/DedupConfigDetail.test.tsx src/app/(shell)/library/dedup/[id]/page.tsx
git commit -m "feat(library): add DedupConfigDetail component and /library/dedup/[id] page route"
```

---

### Task 10: Filter config types + mock seed + state helpers + routes

**Files:**
- Modify: `src/hooks/useLibraryConnections.ts`
- Modify: `src/app/ui-api/mock/data/library.ts`
- Modify: `src/app/ui-api/mock/data/library-state.ts`
- Create: `src/app/ui-api/mock/library/filter/route.ts`
- Create: `src/app/ui-api/mock/library/filter/[id]/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/ui-api/mock/library/filter/route.test.ts
import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /ui-api/mock/library/filter', () => {
  it('returns a list of filter configs', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(2)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('rules')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/app/ui-api/mock/library/filter/route.test.ts
```
Expected: FAIL

- [ ] **Step 3: Add LibraryFilterConfig types to `src/hooks/useLibraryConnections.ts`**

Add after `LibraryDedupConfig`:
```ts
export type LibraryFilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'is_null' | 'is_not_null'

export interface LibraryFilterRule {
  id: string
  field: string
  operator: LibraryFilterOperator
  value: string | null
}

export interface LibraryFilterRuleGroup {
  id: string
  combinator: 'and' | 'or'
  rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>
}

export interface LibraryFilterConfig {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  boundSchemaId: string | null
  rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>
  latestVersion: string
  usedByCount: number
  createdAt: string
  updatedAt: string
}
```

Also add the hook:
```ts
export function useLibraryFilterConfigs() {
  return useLibraryFetch<LibraryFilterConfig[]>('/ui-api/library/filter')
}
```

- [ ] **Step 4: Add mock seed data to `src/app/ui-api/mock/data/library.ts`**

Add after `mockDedupConfigs`:
```ts
export const mockFilterConfigs: MockFilterConfig[] = [
  {
    id: 'filter-1',
    name: 'High-value orders',
    description: 'Passes only orders with amount > 1000',
    folderId: null,
    tags: ['production', 'orders'],
    boundSchemaId: null,
    rules: [
      { id: 'r1', field: 'amount', operator: 'gt', value: '1000' },
    ],
    latestVersion: 'v1',
    usedByCount: 2,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-04-15T09:00:00Z',
  },
  {
    id: 'filter-2',
    name: 'Error events only',
    description: 'Passes log lines with severity=error or severity=fatal',
    folderId: null,
    tags: ['observability'],
    boundSchemaId: null,
    rules: [
      {
        id: 'g1',
        combinator: 'or',
        rules: [
          { id: 'r2', field: 'severity', operator: 'eq', value: 'error' },
          { id: 'r3', field: 'severity', operator: 'eq', value: 'fatal' },
        ],
      },
    ],
    latestVersion: 'v3',
    usedByCount: 4,
    createdAt: '2026-02-05T14:00:00Z',
    updatedAt: '2026-05-02T08:30:00Z',
  },
]

export type MockFilterRule = { id: string; field: string; operator: string; value: string | null }
export type MockFilterRuleGroup = { id: string; combinator: 'and' | 'or'; rules: Array<MockFilterRule | MockFilterRuleGroup> }
export type MockFilterConfig = {
  id: string; name: string; description: string | null
  folderId: string | null; tags: string[]
  boundSchemaId: string | null
  rules: Array<MockFilterRule | MockFilterRuleGroup>
  latestVersion: string; usedByCount: number
  createdAt: string; updatedAt: string
}
```

- [ ] **Step 5: Add filter state helpers to `src/app/ui-api/mock/data/library-state.ts`**

```ts
import { mockFilterConfigs, type MockFilterConfig } from './library'

const filterConfigs = new Map<string, MockFilterConfig>()
mockFilterConfigs.forEach(f => filterConfigs.set(f.id, { ...f }))

export function listFilterConfigs(): MockFilterConfig[] {
  return Array.from(filterConfigs.values())
}

export function getFilterConfig(id: string): MockFilterConfig | undefined {
  return filterConfigs.get(id)
}

export function updateFilterConfig(id: string, patch: Partial<MockFilterConfig>): MockFilterConfig | null {
  const existing = filterConfigs.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  filterConfigs.set(id, updated)
  return updated
}

export function deleteFilterConfig(id: string): boolean {
  return filterConfigs.delete(id)
}
```

- [ ] **Step 6: Create mock API routes**

Create `src/app/ui-api/mock/library/filter/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { listFilterConfigs } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listFilterConfigs())
}
```

Create `src/app/ui-api/mock/library/filter/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getFilterConfig, updateFilterConfig, deleteFilterConfig } from '@/src/app/ui-api/mock/data/library-state'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const item = getFilterConfig(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const patch = await req.json()
  const updated = updateFilterConfig(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const deleted = deleteFilterConfig(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 7: Run tests**

```bash
pnpm vitest run src/app/ui-api/mock/library/filter/route.test.ts
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useLibraryConnections.ts src/app/ui-api/mock/data/library.ts src/app/ui-api/mock/data/library-state.ts src/app/ui-api/mock/library/filter/route.ts src/app/ui-api/mock/library/filter/[id]/route.ts src/app/ui-api/mock/library/filter/route.test.ts
git commit -m "feat(library): add LibraryFilterConfig types, mock seed, state helpers, and API routes"
```

---

### Task 11: FilterConfigsList + FilterConfigDetail + page route

**Files:**
- Create: `src/modules/library/components/FilterConfigsList.tsx`
- Create: `src/modules/library/components/FilterConfigDetail.tsx`
- Modify: `src/modules/library/components/LibraryClient.tsx`
- Create: `src/app/(shell)/library/filter/[id]/page.tsx`

**Design reference (L2 from library-detail-artboards.jsx):**
- List: name + combinator chip + rule count + version badge + used-by count
- Detail left (2fr): rule builder read-only display (field/op/value rows, OR/AND groups) + used-by
- Detail right (1fr): metadata + danger zone

- [ ] **Step 1: Write the failing tests**

```tsx
// src/modules/library/components/FilterConfigsList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterConfigsList } from './FilterConfigsList'
import type { LibraryFilterConfig } from '@/src/hooks/useLibraryConnections'

const mockConfigs: LibraryFilterConfig[] = [
  {
    id: 'filter-1', name: 'High-value orders', description: null,
    folderId: null, tags: [],
    boundSchemaId: null,
    rules: [{ id: 'r1', field: 'amount', operator: 'gt', value: '1000' }],
    latestVersion: 'v1', usedByCount: 2,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'filter-2', name: 'Error events', description: null,
    folderId: null, tags: [],
    boundSchemaId: null,
    rules: [{ id: 'g1', combinator: 'or', rules: [] } as any],
    latestVersion: 'v3', usedByCount: 4,
    createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

describe('FilterConfigsList', () => {
  it('renders a card for each config', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    expect(screen.getByText('High-value orders')).toBeInTheDocument()
    expect(screen.getByText('Error events')).toBeInTheDocument()
  })

  it('shows version badge', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('each card links to /library/filter/[id]', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/library/filter/filter-1')).toBe(true)
  })

  it('renders empty state when no configs', () => {
    render(<FilterConfigsList configs={[]} />)
    expect(screen.getByText(/No filter configs/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/modules/library/components/FilterConfigsList.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create FilterConfigsList**

Create `src/modules/library/components/FilterConfigsList.tsx`:
```tsx
import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryFilterConfig, LibraryFilterRule, LibraryFilterRuleGroup } from '@/src/hooks/useLibraryConnections'

function countRules(rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>): number {
  return rules.reduce((acc, r) => {
    if ('rules' in r) return acc + countRules(r.rules)
    return acc + 1
  }, 0)
}

type Props = { configs: LibraryFilterConfig[] }

export function FilterConfigsList({ configs }: Props) {
  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="body-3 text-[var(--text-secondary)]">No filter configs yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {configs.map(cfg => (
        <Link key={cfg.id} href={`/library/filter/${cfg.id}`} className="block">
          <Card variant="dark" className="p-4 h-full hover:border-[var(--surface-border-hover)] transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="title-6 text-[var(--text-primary)] truncate">{cfg.name}</span>
              <Badge variant="secondary">{cfg.latestVersion}</Badge>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">{countRules(cfg.rules)} rule{countRules(cfg.rules) !== 1 ? 's' : ''}</Badge>
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <span className="caption-1 text-[var(--text-secondary)]">
                {cfg.usedByCount} pipeline{cfg.usedByCount !== 1 ? 's' : ''}
              </span>
              <span className="caption-1 text-[var(--text-secondary)]">
                {new Date(cfg.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create FilterConfigDetail**

Create `src/modules/library/components/FilterConfigDetail.tsx`:
```tsx
'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryFilterConfig, LibraryFilterRule, LibraryFilterRuleGroup } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function RuleRow({ rule }: { rule: LibraryFilterRule }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--surface-border)] last:border-0">
      <span className="font-mono body-3 text-[var(--text-primary)]">{rule.field}</span>
      <Badge variant="outline">{rule.operator.replace('_', ' ')}</Badge>
      {rule.value !== null && (
        <span className="body-3 text-[var(--text-secondary)]">{rule.value}</span>
      )}
    </div>
  )
}

function RuleGroup({ group, depth = 0 }: { group: LibraryFilterRuleGroup; depth?: number }) {
  return (
    <div className={`pl-${depth > 0 ? 4 : 0}`}>
      <Badge variant="secondary" className="mb-2">{group.combinator.toUpperCase()}</Badge>
      <div className="pl-3 border-l-2 border-[var(--surface-border)]">
        {group.rules.map(r => (
          'rules' in r
            ? <RuleGroup key={r.id} group={r as LibraryFilterRuleGroup} depth={depth + 1} />
            : <RuleRow key={r.id} rule={r as LibraryFilterRule} />
        ))}
      </div>
    </div>
  )
}

type Props = {
  config: LibraryFilterConfig
  usedBy: UsedByEntry[]
}

export function FilterConfigDetail({ config, usedBy }: Props) {
  const router = useRouter()
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <h1 className="title-4 text-[var(--text-primary)]">{config.name}</h1>
        <Badge variant="secondary">{config.latestVersion}</Badge>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left: rules + used-by */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Filter rules</h2>
            <div>
              {config.rules.map(r => (
                'rules' in r
                  ? <RuleGroup key={r.id} group={r as LibraryFilterRuleGroup} />
                  : <RuleRow key={r.id} rule={r as LibraryFilterRule} />
              ))}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length}</span>}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {usedBy.map(e => (
                  <div key={e.pipelineId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                    <Badge variant={colorMap[e.health]} className="w-2 h-2 p-0 rounded-full" />
                    <span className="body-3 text-[var(--text-primary)]">{e.pipelineName}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: metadata + danger */}
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            {[
              ['Created', new Date(config.createdAt).toLocaleDateString()],
              ['Updated', new Date(config.updatedAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-4 py-2 border-b border-[var(--surface-border)] last:border-0">
                <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
                <span className="body-3 text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this filter will remove it from all pipelines that reference it.
            </p>
            <Button variant="destructive" size="sm">Delete filter</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the page route**

Create `src/app/(shell)/library/filter/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getApiUrl } from '@/src/utils/mock-api'
import { FilterConfigDetail } from '@/src/modules/library/components/FilterConfigDetail'
import type { LibraryFilterConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ id: string }> }

export default async function FilterConfigPage({ params }: Props) {
  const { id } = await params

  let config: LibraryFilterConfig
  let usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getFilterConfig } = await import('@/src/app/ui-api/mock/data/library-state')
    const found = getFilterConfig(id)
    if (!found) notFound()
    config = found as LibraryFilterConfig
  } else {
    const res = await fetch(getApiUrl(`library/filter/${id}`), { cache: 'no-store' })
    if (!res.ok) notFound()
    config = await res.json()
  }

  return <FilterConfigDetail config={config} usedBy={usedBy} />
}
```

- [ ] **Step 6: Wire FilterConfigsList into LibraryClient**

In `src/modules/library/components/LibraryClient.tsx`:
```tsx
import { FilterConfigsList } from './FilterConfigsList'
import { useLibraryFilterConfigs } from '@/src/hooks/useLibraryConnections'

// Inside component:
const { data: filterConfigs, isLoading: filterLoading } = useLibraryFilterConfigs()

// Replace filter section stub:
case 'filter':
  return filterLoading
    ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{/* skeleton */}</div>
    : <FilterConfigsList configs={filterConfigs ?? []} />
```

- [ ] **Step 7: Run all new tests**

```bash
pnpm vitest run src/modules/library/components/FilterConfigsList.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 8: Run full suite**

```bash
pnpm vitest run
```
Expected: all passing, no regressions.

- [ ] **Step 9: Commit**

```bash
git add src/modules/library/components/FilterConfigsList.tsx src/modules/library/components/FilterConfigsList.test.tsx src/modules/library/components/FilterConfigDetail.tsx src/app/(shell)/library/filter/[id]/page.tsx src/modules/library/components/LibraryClient.tsx
git commit -m "feat(library): add FilterConfigsList, FilterConfigDetail, /library/filter/[id] route, and LibraryClient wiring"
```

---

## Summary

After all 11 tasks are complete, the library module will match the design artboards:

| Area | Before | After |
|------|--------|-------|
| ConnectionDetail | Raw JSON `<pre>` dump | kv-rows + used-by pills grid + health/metadata/danger sidebar |
| SchemaDetail | Mixed layout, sidebar/main swapped | 2fr/1fr: fields table + used-by table left; metadata/versions/danger right |
| SchemaList | No source filter, no version/drift | Source filter chips (All/Kafka/OTLP/Manual), version badge, drift border |
| UsedByEntry | `{pipelineId, pipelineName, pinnedVersion?}` | `+health, +status, +drift` |
| Dedup section | "Coming soon" stub | Full list + detail + page route |
| Filter section | "Coming soon" stub | Full list + detail + page route |
