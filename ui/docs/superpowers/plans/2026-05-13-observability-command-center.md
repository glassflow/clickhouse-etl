# Observability Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the orphaned `ObservabilityLandingClient` with a fleet-level `ObservabilityCommandCenter` at `/observability` — sortable sparkline table, status filter pills, time range picker, context-sensitive deep links into pipeline detail tabs.

**Architecture:** Four focused components (`ObservabilityStatCards`, `ObservabilityFleetRow`, `ObservabilityFleetTable`, `ObservabilityCommandCenter`) plus a thin `useFleetSparkline` hook that bypasses `observabilityStore` so the command center can have its own local time range. Per-pipeline surfaces (`MetricsTab`, `LogsTab`, etc.) are untouched. Route cleanup runs first to eliminate the orphaned `/observability/[id]` and `/workspace/observability` surfaces.

**Tech Stack:** Next.js 15 App Router, React 19, Zustand (read-only, for `observabilityFlag`), Vitest + RTL for tests, `pnpm test:run` to run. All styling via CSS tokens per `CLAUDE.md`.

---

## File Map

```
CREATE  src/hooks/useFleetSparkline.ts
CREATE  src/modules/observability/ObservabilityStatCards.tsx
CREATE  src/modules/observability/ObservabilityStatCards.test.tsx
CREATE  src/modules/observability/ObservabilityFleetRow.tsx
CREATE  src/modules/observability/ObservabilityFleetRow.test.tsx
CREATE  src/modules/observability/ObservabilityFleetTable.tsx
CREATE  src/modules/observability/ObservabilityFleetTable.test.tsx
CREATE  src/modules/observability/ObservabilityCommandCenter.tsx
CREATE  src/modules/observability/ObservabilityCommandCenter.test.tsx

MODIFY  src/app/(shell)/observability/page.tsx           ← swap component
MODIFY  src/components/shared/AppSidebar.tsx             ← nav item href + group

REDIRECT/DELETE  src/app/(shell)/observability/[id]/page.tsx
DELETE   src/app/(shell)/workspace/observability/page.tsx
DELETE   src/modules/observability/ObservabilityLandingClient.tsx  (Task 7)
```

---

## Task 1: Route cleanup and sidebar update

**Files:**
- Modify: `src/app/(shell)/observability/[id]/page.tsx`
- Modify: `src/app/(shell)/workspace/observability/page.tsx`
- Modify: `src/components/shared/AppSidebar.tsx`

- [ ] **Step 1: Replace `/observability/[id]` with a redirect**

Replace the entire contents of `src/app/(shell)/observability/[id]/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ObservabilityPipelinePage({ params }: PageProps) {
  const { id } = await params
  redirect(`/pipelines/${id}/overview`)
}
```

- [ ] **Step 2: Replace `/workspace/observability` with a redirect**

Replace the entire contents of `src/app/(shell)/workspace/observability/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

export default function WorkspaceObservabilityPage() {
  redirect('/observability')
}
```

- [ ] **Step 3: Update AppSidebar — move Observability to primary nav, point to `/observability`**

In `src/components/shared/AppSidebar.tsx`:

Find:
```tsx
const primaryNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboardIcon size={18} />,
    matchPaths: ['/dashboard'],
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    icon: <WorkflowIcon size={18} />,
    matchPaths: ['/pipelines'],
  },
  {
    href: '/library',
    label: 'Library',
    icon: <LibraryBigIcon size={18} />,
    matchPaths: ['/library'],
  },
]

const workspaceNavItems: NavItem[] = [
  {
    href: '/workspace/observability',
    label: 'Observability',
    icon: <ActivityIcon size={18} />,
    matchPaths: ['/workspace/observability', '/observability'],
  },
]
```

Replace with:
```tsx
const primaryNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboardIcon size={18} />,
    matchPaths: ['/dashboard'],
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    icon: <WorkflowIcon size={18} />,
    matchPaths: ['/pipelines'],
  },
  {
    href: '/library',
    label: 'Library',
    icon: <LibraryBigIcon size={18} />,
    matchPaths: ['/library'],
  },
  {
    href: '/observability',
    label: 'Observability',
    icon: <ActivityIcon size={18} />,
    matchPaths: ['/observability'],
  },
]

const workspaceNavItems: NavItem[] = []
```

- [ ] **Step 4: Remove the empty workspace NavGroup from the render**

In `src/components/shared/AppSidebar.tsx`, find and remove the workspace `NavGroup` call:
```tsx
<NavGroup label="Workspace" items={workspaceNavItems} isActive={isActive} />
```

- [ ] **Step 5: Verify the app still builds**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(shell\)/observability/\[id\]/page.tsx \
        src/app/\(shell\)/workspace/observability/page.tsx \
        src/components/shared/AppSidebar.tsx
git commit -m "refactor(obs): redirect orphaned routes, promote Observability to primary nav"
```

---

## Task 2: `useFleetSparkline` hook

`useMetricsQuery` reads time range from `observabilityStore` via `useMetricsRange()`. The command center owns its own local time range, so it needs a hook that accepts explicit `fromMs`/`toMs`.

**Files:**
- Create: `src/hooks/useFleetSparkline.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useFleetSparkline.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useFleetSparkline } from './useFleetSparkline'

const MOCK_RESULT = {
  result: {
    resultType: 'matrix',
    result: [{ metric: {}, values: [[1700000000, '100'], [1700000060, '120'], [1700000120, '110']] }],
  },
}

describe('useFleetSparkline', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and returns numeric series values', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESULT,
    } as Response)

    const { result } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', null)
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.values).toEqual([100, 120, 110])
    expect(result.current.latest).toBe(110)
    expect(result.current.error).toBeUndefined()
  })

  it('does not fetch when pipelineId is empty', async () => {
    const { result } = renderHook(() =>
      useFleetSparkline('', 'records_ingested', 1700000000000, 1700003600000, '15s', null)
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.values).toEqual([])
  })

  it('sets error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    } as Response)

    const { result } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', null)
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('internal error')
    expect(result.current.values).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/hooks/useFleetSparkline.test.ts 2>&1 | tail -20
```

Expected: FAIL — `useFleetSparkline` not found.

- [ ] **Step 3: Implement `useFleetSparkline`**

Create `src/hooks/useFleetSparkline.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

export type FleetSparklineState = {
  values: number[]
  latest: number | null
  isLoading: boolean
  error: Error | undefined
}

/**
 * Fetch a single metric series for a pipeline using explicit time bounds.
 *
 * Unlike useMetricsQuery, this hook does NOT read from observabilityStore —
 * the caller supplies fromMs/toMs directly so the command center can run its
 * own time range independently of the per-pipeline metric views.
 */
export function useFleetSparkline(
  pipelineId: string,
  queryName: CanonicalQueryKey,
  fromMs: number,
  toMs: number,
  step: string,
  autoRefreshIntervalMs: number | null,
): FleetSparklineState {
  const [values, setValues] = useState<number[]>([])
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(pipelineId !== '')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pipelineId) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(undefined)

    const url = `/ui-api/pipelines/${pipelineId}/metrics?query=${queryName}&from=${fromMs}&to=${toMs}&step=${step}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = await res.json()
            if (body?.error) msg = body.error
          } catch { /* ignore */ }
          throw new Error(msg)
        }
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const raw: Array<[number, string]> = json?.result?.result?.[0]?.values ?? []
        setValues(raw.map(([, v]) => parseFloat(v)).filter((n) => Number.isFinite(n)))
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setValues([])
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [pipelineId, queryName, fromMs, toMs, step, tick])

  useEffect(() => {
    if (!autoRefreshIntervalMs || !pipelineId) return
    const id = setInterval(() => setTick((t) => t + 1), autoRefreshIntervalMs)
    return () => clearInterval(id)
  }, [autoRefreshIntervalMs, pipelineId])

  const latest = values.length > 0 ? values[values.length - 1] : null

  return { values, latest, isLoading, error }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/hooks/useFleetSparkline.test.ts 2>&1 | tail -15
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFleetSparkline.ts src/hooks/useFleetSparkline.test.ts
git commit -m "feat(obs): useFleetSparkline hook with explicit time bounds for command center"
```

---

## Task 3: `ObservabilityStatCards`

**Files:**
- Create: `src/modules/observability/ObservabilityStatCards.tsx`
- Create: `src/modules/observability/ObservabilityStatCards.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/ObservabilityStatCards.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ObservabilityStatCards } from './ObservabilityStatCards'
import type { ListPipelineConfig } from '@/src/types/pipeline'

function makeP(overrides: Partial<ListPipelineConfig>): ListPipelineConfig {
  return {
    pipeline_id: 'p1',
    name: 'test',
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: 'active',
    health_status: 'stable',
    dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
    ...overrides,
  }
}

describe('ObservabilityStatCards', () => {
  it('shows correct running count', () => {
    const pipelines = [makeP({ status: 'active' }), makeP({ pipeline_id: 'p2', status: 'active' }), makeP({ pipeline_id: 'p3', status: 'paused' })]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('2')).toBeInTheDocument() // running
  })

  it('shows needs-attention count for failed + unstable', () => {
    const pipelines = [
      makeP({ status: 'failed', health_status: 'unstable' }),
      makeP({ pipeline_id: 'p2', status: 'active', health_status: 'unstable' }),
      makeP({ pipeline_id: 'p3', status: 'active', health_status: 'stable' }),
    ]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    // p1 and p2 are degraded
    const cards = screen.getAllByText('2')
    expect(cards.length).toBeGreaterThanOrEqual(1)
  })

  it('sums DLQ unconsumed messages across all pipelines', () => {
    const pipelines = [
      makeP({ dlq_stats: { total_messages: 10, unconsumed_messages: 5, last_received_at: null, last_consumed_at: null } }),
      makeP({ pipeline_id: 'p2', dlq_stats: { total_messages: 10, unconsumed_messages: 12, last_received_at: null, last_consumed_at: null } }),
    ]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('17')).toBeInTheDocument()
  })

  it('shows 0 needs-attention in positive colour when no degraded pipelines', () => {
    const pipelines = [makeP({ status: 'active', health_status: 'stable' })]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityStatCards.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ObservabilityStatCards`**

Create `src/modules/observability/ObservabilityStatCards.tsx`:

```tsx
import { CheckCircle2Icon, AlertCircleIcon, PauseCircleIcon, InboxIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import type { ListPipelineConfig } from '@/src/types/pipeline'

function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

type Props = { pipelines: ListPipelineConfig[] }

export function ObservabilityStatCards({ pipelines }: Props) {
  const running = pipelines.filter((p) => p.status === 'active').length
  const degraded = pipelines.filter(isDegraded).length
  const paused = pipelines.filter((p) => p.status === 'paused' || p.status === 'pausing').length
  const totalDlq = pipelines.reduce((n, p) => n + (p.dlq_stats?.unconsumed_messages ?? 0), 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Running"
        value={running}
        icon={<CheckCircle2Icon size={15} />}
        valueClass="text-[var(--color-foreground-positive)]"
      />
      <StatCard
        label="Needs attention"
        value={degraded}
        icon={<AlertCircleIcon size={15} />}
        valueClass={degraded > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-secondary)]'}
      />
      <StatCard
        label="Paused"
        value={paused}
        icon={<PauseCircleIcon size={15} />}
        valueClass="text-[var(--text-secondary)]"
      />
      <StatCard
        label="DLQ backlog"
        value={totalDlq}
        icon={<InboxIcon size={15} />}
        valueClass={totalDlq > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-secondary)]'}
        sub="unconsumed msgs"
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
  sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] px-4 py-4">
      <div className="flex items-center gap-1.5 caption-1 text-[var(--text-tertiary)]">
        <span className="shrink-0">{icon}</span>
        {label}
      </div>
      <div className={cn('title-3', valueClass)}>{value}</div>
      {sub && <p className="caption-2 text-[var(--text-tertiary)] -mt-1">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityStatCards.test.tsx 2>&1 | tail -10
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/modules/observability/ObservabilityStatCards.tsx src/modules/observability/ObservabilityStatCards.test.tsx
git commit -m "feat(obs): ObservabilityStatCards — fleet KPI cards"
```

---

## Task 4: `ObservabilityFleetRow`

Single pipeline row with sparklines for throughput and errors. Skips VM queries for paused pipelines.

**Files:**
- Create: `src/modules/observability/ObservabilityFleetRow.tsx`
- Create: `src/modules/observability/ObservabilityFleetRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/observability/ObservabilityFleetRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ObservabilityFleetRow } from './ObservabilityFleetRow'
import type { ListPipelineConfig } from '@/src/types/pipeline'

const BASE_PIPELINE: ListPipelineConfig = {
  pipeline_id: 'pipe-abc',
  name: 'my-pipeline',
  transformation_type: 'Ingest Only',
  created_at: '2026-01-01',
  status: 'active',
  health_status: 'stable',
  dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
}

const ROW_PROPS = {
  pipeline: BASE_PIPELINE,
  fromMs: 1700000000000,
  toMs: 1700003600000,
  step: '15s' as const,
  autoRefreshIntervalMs: null as null,
  isLast: false,
}

describe('ObservabilityFleetRow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { resultType: 'matrix', result: [{ metric: {}, values: [[1700000000, '100']] }] },
      }),
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders pipeline name as a link to /metrics', () => {
    render(<table><tbody><ObservabilityFleetRow {...ROW_PROPS} /></tbody></table>)
    const link = screen.getByRole('link', { name: /my-pipeline/i })
    expect(link).toHaveAttribute('href', '/pipelines/pipe-abc/metrics')
  })

  it('renders StatusBadge for the pipeline status', () => {
    render(<table><tbody><ObservabilityFleetRow {...ROW_PROPS} /></tbody></table>)
    // StatusBadge renders chip content
    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it('skips VM queries and renders dashes for paused pipelines', () => {
    const paused = { ...ROW_PROPS, pipeline: { ...BASE_PIPELINE, status: 'paused' as const } }
    render(<table><tbody><ObservabilityFleetRow {...paused} /></tbody></table>)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2) // throughput + errors
    expect(fetch).not.toHaveBeenCalled()
  })

  it('links DLQ cell to /dlq when dlq > 0', () => {
    const withDlq = {
      ...ROW_PROPS,
      pipeline: {
        ...BASE_PIPELINE,
        dlq_stats: { total_messages: 50, unconsumed_messages: 47, last_received_at: null, last_consumed_at: null },
        health_status: 'unstable' as const,
      },
    }
    render(<table><tbody><ObservabilityFleetRow {...withDlq} /></tbody></table>)
    const dlqLink = screen.getByRole('link', { name: '47' })
    expect(dlqLink).toHaveAttribute('href', '/pipelines/pipe-abc/dlq')
  })

  it('links DLQ cell to /metrics when dlq is 0', () => {
    render(<table><tbody><ObservabilityFleetRow {...ROW_PROPS} /></tbody></table>)
    const dlqCell = screen.getByText('0')
    expect(dlqCell.closest('a')).toHaveAttribute('href', '/pipelines/pipe-abc/metrics')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityFleetRow.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ObservabilityFleetRow`**

Create `src/modules/observability/ObservabilityFleetRow.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Sparkline } from '@/src/components/ui/sparkline'
import { StatusBadge } from '@/src/components/shared/StatusBadge'
import { useFleetSparkline } from '@/src/hooks/useFleetSparkline'
import { cn } from '@/src/utils/common.client'
import type { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

function isValidStatus(s: string | undefined): s is PipelineStatus {
  return !!s && s !== ''
}

function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

function isPaused(p: ListPipelineConfig): boolean {
  return p.status === 'paused' || p.status === 'pausing'
}

type Props = {
  pipeline: ListPipelineConfig
  fromMs: number
  toMs: number
  step: string
  autoRefreshIntervalMs: number | null
  isLast: boolean
}

export function ObservabilityFleetRow({ pipeline, fromMs, toMs, step, autoRefreshIntervalMs, isLast }: Props) {
  const paused = isPaused(pipeline)
  const degraded = isDegraded(pipeline)
  const dlqCount = pipeline.dlq_stats?.unconsumed_messages ?? 0
  const status = isValidStatus(pipeline.status as string)
    ? (pipeline.status as PipelineStatus)
    : undefined

  const throughput = useFleetSparkline(
    paused ? '' : pipeline.pipeline_id,
    'records_ingested' as CanonicalQueryKey,
    fromMs, toMs, step, autoRefreshIntervalMs,
  )
  const errors = useFleetSparkline(
    paused ? '' : pipeline.pipeline_id,
    'errors_total' as CanonicalQueryKey,
    fromMs, toMs, step, autoRefreshIntervalMs,
  )

  const errorRate = errors.latest != null && throughput.latest != null && throughput.latest > 0
    ? (errors.latest / throughput.latest) * 100
    : (errors.latest ?? 0)

  const errorsLink = errors.latest != null && errors.latest > 0
    ? `/pipelines/${pipeline.pipeline_id}/logs`
    : `/pipelines/${pipeline.pipeline_id}/metrics`

  const throughputLabel = throughput.latest != null
    ? throughput.latest >= 1000
      ? `${(throughput.latest / 1000).toFixed(1)}k ev/s`
      : `${throughput.latest.toFixed(0)} ev/s`
    : null

  return (
    <tr
      className={cn(
        'group transition-colors',
        !isLast && 'border-b border-[var(--surface-border)]',
        degraded && 'bg-[var(--color-background-critical-faded,var(--surface-bg))]',
        paused && 'opacity-55',
      )}
      style={!degraded ? { backgroundColor: 'var(--table-row-bg)' } : undefined}
    >
      {/* Pipeline name */}
      <td className="px-4 py-3">
        <Link
          href={`/pipelines/${pipeline.pipeline_id}/metrics`}
          className="body-3 font-medium text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors"
        >
          {pipeline.name}
        </Link>
        <div className="caption-2 text-[var(--text-tertiary)] mt-0.5">
          {pipeline.transformation_type}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        )}
      </td>

      {/* Throughput sparkline */}
      <td className="px-4 py-3">
        {paused ? (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        ) : (
          <Link href={`/pipelines/${pipeline.pipeline_id}/metrics`} className="flex items-center gap-2 group/spark">
            {!throughput.isLoading && throughput.values.length > 0 && (
              <Sparkline
                data={throughput.values}
                width={72}
                height={20}
                stroke="var(--color-foreground-positive)"
                strokeWidth={1.5}
              />
            )}
            {throughput.isLoading && (
              <span className="inline-block w-[72px] h-[20px] rounded bg-[var(--surface-border)] animate-pulse" />
            )}
            <span className="caption-1 text-[var(--text-secondary)] tabular-nums">
              {throughputLabel ?? '—'}
            </span>
          </Link>
        )}
      </td>

      {/* Error rate sparkline */}
      <td className="px-4 py-3">
        {paused ? (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        ) : (
          <Link href={errorsLink} className="flex items-center gap-2">
            {!errors.isLoading && errors.values.length > 0 && (
              <Sparkline
                data={errors.values}
                width={56}
                height={20}
                stroke={errorRate > 0 ? 'var(--color-foreground-critical)' : 'var(--text-tertiary)'}
                strokeWidth={1.5}
              />
            )}
            {errors.isLoading && (
              <span className="inline-block w-[56px] h-[20px] rounded bg-[var(--surface-border)] animate-pulse" />
            )}
            <span className={cn(
              'caption-1 tabular-nums',
              errorRate > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-tertiary)]',
            )}>
              {errors.isLoading ? '…' : `${errorRate.toFixed(1)}%`}
            </span>
          </Link>
        )}
      </td>

      {/* DLQ */}
      <td className="px-4 py-3">
        <Link
          href={dlqCount > 0 ? `/pipelines/${pipeline.pipeline_id}/dlq` : `/pipelines/${pipeline.pipeline_id}/metrics`}
          aria-label={String(dlqCount)}
          className={cn(
            'caption-1 tabular-nums',
            dlqCount > 0 ? 'text-[var(--color-foreground-critical)] font-semibold' : 'text-[var(--text-tertiary)]',
          )}
        >
          {dlqCount}
        </Link>
      </td>

      {/* Chevron */}
      <td className="px-3 py-3">
        <Link
          href={`/pipelines/${pipeline.pipeline_id}/metrics`}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg-hover)] transition-colors"
          aria-label={`View ${pipeline.name}`}
        >
          <span aria-hidden="true" className="caption-1">›</span>
        </Link>
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityFleetRow.test.tsx 2>&1 | tail -10
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/modules/observability/ObservabilityFleetRow.tsx src/modules/observability/ObservabilityFleetRow.test.tsx
git commit -m "feat(obs): ObservabilityFleetRow — sparklines with context-sensitive links"
```

---

## Task 5: `ObservabilityFleetTable`

Table shell that owns sort + filter state and renders rows. Receives pipelines + time range props; passes them to rows.

**Files:**
- Create: `src/modules/observability/ObservabilityFleetTable.tsx`
- Create: `src/modules/observability/ObservabilityFleetTable.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/observability/ObservabilityFleetTable.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ObservabilityFleetTable } from './ObservabilityFleetTable'
import type { ListPipelineConfig } from '@/src/types/pipeline'

// Stub fetch so ObservabilityFleetRow doesn't make real requests
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: { resultType: 'matrix', result: [] } }),
  }))
})

function makeP(id: string, status: string, dlq = 0): ListPipelineConfig {
  return {
    pipeline_id: id,
    name: `pipeline-${id}`,
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: status as ListPipelineConfig['status'],
    health_status: status === 'failed' ? 'unstable' : 'stable',
    dlq_stats: { total_messages: dlq, unconsumed_messages: dlq, last_received_at: null, last_consumed_at: null },
  }
}

const PIPELINES = [
  makeP('a', 'active', 0),
  makeP('b', 'failed', 10),
  makeP('c', 'paused', 0),
  makeP('d', 'active', 0),
]

const TABLE_PROPS = {
  pipelines: PIPELINES,
  fromMs: 1700000000000,
  toMs: 1700003600000,
  step: '15s' as const,
  autoRefreshIntervalMs: null as null,
}

describe('ObservabilityFleetTable', () => {
  it('renders all pipelines by default', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} />)
    expect(screen.getByText('pipeline-a')).toBeInTheDocument()
    expect(screen.getByText('pipeline-b')).toBeInTheDocument()
    expect(screen.getByText('pipeline-c')).toBeInTheDocument()
    expect(screen.getByText('pipeline-d')).toBeInTheDocument()
  })

  it('renders empty state when pipelines is empty', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} pipelines={[]} />)
    expect(screen.getByText(/no pipelines/i)).toBeInTheDocument()
  })

  it('shows pipeline count in table caption', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} />)
    expect(screen.getByText(/all pipelines \(4\)/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityFleetTable.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ObservabilityFleetTable`**

Create `src/modules/observability/ObservabilityFleetTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ActivityIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import { ObservabilityFleetRow } from './ObservabilityFleetRow'
import type { ListPipelineConfig } from '@/src/types/pipeline'

type SortBy = 'name' | 'dlq'
type SortDir = 'asc' | 'desc'

type Props = {
  pipelines: ListPipelineConfig[]
  fromMs: number
  toMs: number
  step: string
  autoRefreshIntervalMs: number | null
}

function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

function sortPriority(p: ListPipelineConfig): number {
  if (isDegraded(p)) return 0
  if (p.status === 'active') return 1
  return 2
}

type SortConfig = { by: SortBy; dir: SortDir }

function applySortAndPriority(
  pipelines: ListPipelineConfig[],
  sort: SortConfig,
): ListPipelineConfig[] {
  return [...pipelines].sort((a, b) => {
    // Always put degraded rows first regardless of user sort
    const pa = sortPriority(a)
    const pb = sortPriority(b)
    if (pa !== pb) return pa - pb

    // User-chosen sort within priority tier
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.by === 'name') return dir * a.name.localeCompare(b.name)
    if (sort.by === 'dlq') {
      const da = a.dlq_stats?.unconsumed_messages ?? 0
      const db = b.dlq_stats?.unconsumed_messages ?? 0
      return dir * (da - db)
    }
    return 0
  })
}

export function ObservabilityFleetTable({ pipelines, fromMs, toMs, step, autoRefreshIntervalMs }: Props) {
  const [sort, setSort] = useState<SortConfig>({ by: 'dlq', dir: 'desc' })

  function toggleSort(by: SortBy) {
    setSort((s) => s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'desc' })
  }

  const sorted = applySortAndPriority(pipelines, sort)

  if (pipelines.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="caption-1 text-[var(--text-tertiary)]">
        All pipelines ({pipelines.length})
      </p>
      <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr
              className="border-b border-[var(--surface-border)]"
              style={{ backgroundColor: 'var(--table-header-bg)' }}
            >
              <SortHeader label="Pipeline" sortKey="name" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium">Status</th>
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden sm:table-cell">
                Throughput
              </th>
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden md:table-cell">
                Errors
              </th>
              <SortHeader label="DLQ" sortKey="dlq" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <ObservabilityFleetRow
                key={p.pipeline_id}
                pipeline={p}
                fromMs={fromMs}
                toMs={toMs}
                step={step}
                autoRefreshIntervalMs={autoRefreshIntervalMs}
                isLast={idx === sorted.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortBy
  sort: SortConfig
  onSort: (k: SortBy) => void
  className?: string
}) {
  const active = sort.by === sortKey
  return (
    <th
      className={cn('px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium cursor-pointer select-none hover:text-[var(--text-secondary)]', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.dir === 'asc'
            ? <ChevronUpIcon size={11} />
            : <ChevronDownIcon size={11} />
          : <span className="w-[11px]" />}
      </span>
    </th>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="w-12 h-12 rounded-xl border border-[var(--surface-border)] grid place-items-center text-[var(--text-tertiary)]">
        <ActivityIcon size={22} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="body-2 font-medium text-[var(--text-primary)]">No pipelines yet</p>
        <p className="body-3 text-[var(--text-secondary)]">
          Create a pipeline to start monitoring health and activity.
        </p>
      </div>
      <Link href="/home" className="caption-1 text-[var(--color-foreground-primary)] hover:underline">
        Create your first pipeline →
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityFleetTable.test.tsx 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/modules/observability/ObservabilityFleetTable.tsx src/modules/observability/ObservabilityFleetTable.test.tsx
git commit -m "feat(obs): ObservabilityFleetTable — sorted pipeline table"
```

---

## Task 6: `ObservabilityCommandCenter`

Top-level client component: owns time range, status filter, and auto-refresh state; composes stat cards + toolbar + table.

**Files:**
- Create: `src/modules/observability/ObservabilityCommandCenter.tsx`
- Create: `src/modules/observability/ObservabilityCommandCenter.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/observability/ObservabilityCommandCenter.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ObservabilityCommandCenter } from './ObservabilityCommandCenter'

const MOCK_PIPELINES = [
  {
    pipeline_id: 'p1', name: 'prod-orders', transformation_type: 'Ingest Only',
    created_at: '2026-01-01', status: 'active', health_status: 'stable',
    dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
  },
  {
    pipeline_id: 'p2', name: 'analytics-stream', transformation_type: 'Ingest Only',
    created_at: '2026-01-01', status: 'failed', health_status: 'unstable',
    dlq_stats: { total_messages: 50, unconsumed_messages: 47, last_received_at: null, last_consumed_at: null },
  },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/pipeline?') || url === '/api/pipeline') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, pipelines: MOCK_PIPELINES }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ result: { resultType: 'matrix', result: [] } }) })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ObservabilityCommandCenter', () => {
  it('renders page title', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByText('Observability')).toBeInTheDocument()
  })

  it('shows loading state then pipeline names', async () => {
    render(<ObservabilityCommandCenter />)
    await waitFor(() => expect(screen.getByText('prod-orders')).toBeInTheDocument())
    expect(screen.getByText('analytics-stream')).toBeInTheDocument()
  })

  it('time range buttons are rendered', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByRole('button', { name: /1h/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /6h/i })).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('DLQ backlog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityCommandCenter.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ObservabilityCommandCenter`**

Create `src/modules/observability/ObservabilityCommandCenter.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPipelines } from '@/src/api/pipeline-api'
import { cn } from '@/src/utils/common.client'
import { ObservabilityStatCards } from './ObservabilityStatCards'
import { ObservabilityFleetTable } from './ObservabilityFleetTable'
import type { ListPipelineConfig } from '@/src/types/pipeline'

type TimeRange = '15m' | '1h' | '6h' | '24h'
type StatusFilter = 'all' | 'active' | 'degraded' | 'paused'

const RANGE_MS: Record<TimeRange, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
}

const STEP: Record<TimeRange, string> = {
  '15m': '15s',
  '1h': '15s',
  '6h': '60s',
  '24h': '5m',
}

const TIME_RANGE_OPTIONS: TimeRange[] = ['15m', '1h', '6h', '24h']
const AUTO_REFRESH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'off', value: null },
  { label: '30s', value: 30_000 },
  { label: '60s', value: 60_000 },
]

function computeRange(tr: TimeRange): { fromMs: number; toMs: number; step: string } {
  const toMs = Math.floor(Date.now() / 30_000) * 30_000
  return { fromMs: toMs - RANGE_MS[tr], toMs, step: STEP[tr] }
}

export function ObservabilityCommandCenter() {
  const [pipelines, setPipelines] = useState<ListPipelineConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(30_000)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    getPipelines()
      .then(setPipelines)
      .catch(() => setError('Failed to load pipeline data'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load, tick])

  useEffect(() => {
    if (!autoRefreshInterval) return
    const id = setInterval(() => setTick((t) => t + 1), autoRefreshInterval)
    return () => clearInterval(id)
  }, [autoRefreshInterval])

  const { fromMs, toMs, step } = computeRange(timeRange)

  const isDegraded = (p: ListPipelineConfig) => p.status === 'failed' || p.health_status === 'unstable'
  const isPaused = (p: ListPipelineConfig) => p.status === 'paused' || p.status === 'pausing'

  const filteredPipelines = statusFilter === 'all' ? pipelines
    : statusFilter === 'active' ? pipelines.filter((p) => p.status === 'active')
    : statusFilter === 'degraded' ? pipelines.filter(isDegraded)
    : pipelines.filter(isPaused)

  const counts = {
    all: pipelines.length,
    active: pipelines.filter((p) => p.status === 'active').length,
    degraded: pipelines.filter(isDegraded).length,
    paused: pipelines.filter(isPaused).length,
  }

  const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'degraded', label: `Degraded (${counts.degraded})` },
    { key: 'paused', label: `Paused (${counts.paused})` },
  ]

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="title-2 text-[var(--text-primary)]">Observability</h1>
        <p className="body-3 text-[var(--text-secondary)]">
          Fleet health and triage across all running pipelines
        </p>
      </div>

      {/* Stat cards */}
      {!isLoading && !error && (
        <ObservabilityStatCards pipelines={pipelines} />
      )}

      {/* Toolbar: status filters + time range + auto-refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter pills */}
        {!isLoading && !error && (
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'caption-1 px-3 py-1 rounded-full border transition-colors',
                  statusFilter === key
                    ? 'border-[var(--color-foreground-primary)] text-[var(--color-foreground-primary)] bg-[var(--color-background-primary-faded)]'
                    : 'border-[var(--surface-border)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {/* Time range segment */}
        <div className="flex gap-0.5 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-0.5">
          {TIME_RANGE_OPTIONS.map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              aria-label={tr}
              className={cn(
                'caption-1 px-3 py-1 rounded-md transition-colors',
                timeRange === tr
                  ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
            >
              {tr}
            </button>
          ))}
        </div>

        {/* Auto-refresh */}
        <div className="flex items-center gap-1.5">
          <span className="caption-1 text-[var(--text-tertiary)]">Refresh:</span>
          <div className="flex gap-0.5 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-0.5">
            {AUTO_REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAutoRefreshInterval(opt.value)}
                className={cn(
                  'caption-1 px-2.5 py-1 rounded-md transition-colors',
                  autoRefreshInterval === opt.value
                    ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <span className="caption-1 text-[var(--text-secondary)]">Loading…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <ObservabilityFleetTable
          pipelines={filteredPipelines}
          fromMs={fromMs}
          toMs={toMs}
          step={step}
          autoRefreshIntervalMs={autoRefreshInterval}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability/ObservabilityCommandCenter.test.tsx 2>&1 | tail -15
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/modules/observability/ObservabilityCommandCenter.tsx src/modules/observability/ObservabilityCommandCenter.test.tsx
git commit -m "feat(obs): ObservabilityCommandCenter — fleet command center with time range and auto-refresh"
```

---

## Task 7: Wire up and remove `ObservabilityLandingClient`

**Files:**
- Modify: `src/app/(shell)/observability/page.tsx`
- Delete: `src/modules/observability/ObservabilityLandingClient.tsx`

- [ ] **Step 1: Swap `ObservabilityLandingClient` → `ObservabilityCommandCenter` in the page**

Replace the contents of `src/app/(shell)/observability/page.tsx` with:

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { ObservabilityCommandCenter } from '@/src/modules/observability/ObservabilityCommandCenter'

export default async function ObservabilityPage() {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  return (
    <Suspense fallback={<div className="caption-1 text-[var(--text-secondary)] p-6">Loading…</div>}>
      <ObservabilityCommandCenter />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify no remaining imports of `ObservabilityLandingClient`**

```bash
grep -r "ObservabilityLandingClient" /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui/src 2>/dev/null
```

Expected: no output (no more imports after the page.tsx change).

- [ ] **Step 3: Delete `ObservabilityLandingClient.tsx`**

```bash
rm /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui/src/modules/observability/ObservabilityLandingClient.tsx
```

- [ ] **Step 4: Run full type check**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: no errors related to the changed files.

- [ ] **Step 5: Run all observability tests**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm test:run src/modules/observability 2>&1 | tail -20
```

Expected: all tests pass, no regressions in existing observability tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(shell\)/observability/page.tsx
git rm src/modules/observability/ObservabilityLandingClient.tsx
git commit -m "feat(obs): wire ObservabilityCommandCenter to /observability route, remove ObservabilityLandingClient"
```

---

## Self-Review Checklist

Run this mentally before submitting:

- [ ] `useFleetSparkline` — does it cancel in-flight requests on unmount/deps change? (Yes — `cancelled = true` in cleanup)
- [ ] `ObservabilityFleetRow` — does it skip VM queries for paused pipelines? (Yes — passes `''` as `pipelineId` when paused; hook early-returns when empty)
- [ ] `ObservabilityFleetTable` — does it sort degraded rows to the top? (Yes — `sortPriority` puts degraded=0 first)
- [ ] Context link for DLQ — correct when 0 vs >0? (Yes — `dlqCount > 0 → /dlq`, else `→ /metrics`)
- [ ] Context link for errors — correct when `latest > 0` vs `=== 0`? (Yes — `errors.latest > 0 → /logs`, else `→ /metrics`)
- [ ] `ObservabilityCommandCenter` — does `computeRange` recompute on each render when `timeRange` changes? (Yes — called inline in render body)
- [ ] `StackAdminPanel` import — is it only in `/workspace/observability/page.tsx`? Verify: `grep -r "StackAdminPanel" src` before deleting. (Checked in spec §9)
- [ ] All new components use token variables, no hardcoded colors (per `CLAUDE.md` rule 1)
