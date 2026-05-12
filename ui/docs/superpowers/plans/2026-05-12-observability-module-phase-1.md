# Observability Module Phase 1 (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the design-vision gap for the per-pipeline Metrics (M3) and Logs (M4) tabs by 2026-06-14 per ETL-1074 — multi-series dashboard charts, polished drill-down with `OBChartSVG` brush, DLQ peek panel on the dashboard, component filter on metrics, status pill in toolbars, scoping NOTE banner, auto-refresh interval picker.

**Architecture:** Polish + extend existing `src/modules/observability/` scaffolding. The module already covers most structural needs (Zustand `observabilityStore`, `ChartFrame`, `ChartCard` with brush, `DisabledState`, `BrushedRangePill`, `FilterPillRow`, `MiniMetricsStrip`, `useUrlState`, `useMetricsQuery`/`useLogsQuery`/`useLogStream`). Phase 1 adds one new chart primitive (`OBChartSVG`, used only in `DrillDownView`), a handful of small toolbar/dashboard components, and threads a component filter through the metrics surface.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (`strict: true`), Recharts (dashboard grid), custom SVG (drill-down), Zustand (state), Tailwind + CSS-variable tokens, `vitest` + `@testing-library/react` (tests at `*.test.tsx` co-located with components, except `ContextClusterer.test.ts` which sits in `__tests__/`). Package manager: **pnpm** only.

**Reference spec:** `docs/superpowers/specs/2026-05-12-observability-module-design.md` (revised commit `8189b9c3`).

**Cross-cutting conventions (from CLAUDE.md — non-negotiable):**

- Never hardcode colors. Use tokens: `var(--color-foreground-neutral-faded)`, `var(--surface-bg)`, etc. Never `bg-red-500`, never `#A8ADB8`.
- Variant props, never raw CSS classes: `<Button variant="primary" size="sm">` not `<button className="btn-primary">`. `<Badge variant="success">` not `<span className="bg-green-600">`.
- Typography utility classes only: `title-1`–`title-6`, `body-1`–`body-3`, `caption-1`–`caption-2`, `mono-1`–`mono-2`. Never inline `font-size`.
- `className` on primitives = layout only (`p-4`, `gap-2`, `flex`, `grid`). Visual state goes in `variant`.
- `pnpm test:run` runs all tests once. `pnpm test` watches.
- Commit after each task. Never use `git --no-verify`. No `Co-Authored-By` lines (per project convention).

---

## Pre-flight: confirm assumptions

> **Verified 2026-05-12 (post-plan audit on branch `ui-ux-revamp-2.0`):**
>
> - **Baseline tests:** Pre-existing failures unrelated to observability — 8 failures in `modules/pipelines/columns/pipelineListColumns.test.tsx`, 1 in `modules/library/components/SchemaList.test.tsx`, plus unhandled rejections in `lib/__tests__/retry-logic.test.ts`. **Observability tests are green.** When a task step says "all green", interpret as "no NEW failures introduced by this task" — diff against this baseline.
> - **Env vars:** This codebase uses runtime injection (`window.__ENV__` from `generate-env.mjs` for client, `process.env` directly for server). Adding to `next.config.ts` is **NOT required** — server-side code in `/ui-api/observability/stack/route.ts` already reads `VM_RETENTION`/`VL_RETENTION` via `process.env`. Skip the next.config.ts step.
> - **Stack route shape:** `/ui-api/observability/stack` already returns a richer nested shape — see Task 3 notes below. **No backend changes needed.**

- [ ] **Step 1: Run the existing test suite to capture the baseline**

```
pnpm test:run
```

Expected baseline: 9 failed, 1075 passed (see verification block above). Subsequent task steps must not increase the failure count.

- [ ] **Step 2: Env vars — NO-OP (see verification note above)**

This codebase uses runtime env injection; no `next.config.ts` change is required for Phase 1.

- [ ] **Step 3: Stack route — already returns disk/retention (see Task 3 for actual shape)**

---

## Task 1: Replace `autoRefresh: boolean` with `autoRefreshIntervalMs: number | null`

**Why:** `AutoRefreshControl` (Task 2) needs an interval, not a toggle. Doing this first keeps everything below it consistent.

**Files:**
- Modify: `src/store/observability.store.ts`
- Modify: `src/modules/observability/MetricsToolbar.tsx` (consumer)
- Modify: `src/hooks/useMetricsQuery.ts` (if it reads `autoRefresh`)
- Test: `src/store/observability.store.test.ts` (create if missing)

- [ ] **Step 1: Write the failing store test**

Create `src/store/observability.store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { createObservabilitySlice, type ObservabilitySlice } from './observability.store'

function makeStore() {
  return createStore<ObservabilitySlice>()((set, get, api) =>
    createObservabilitySlice(set, get, api),
  )
}

describe('observabilityStore.autoRefreshIntervalMs', () => {
  it('defaults to 30000 (30s)', () => {
    const store = makeStore()
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBe(30_000)
  })

  it('setAutoRefreshIntervalMs(null) disables polling', () => {
    const store = makeStore()
    store.getState().observabilityStore.setAutoRefreshIntervalMs(null)
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBeNull()
  })

  it('setAutoRefreshIntervalMs(15000) updates the interval', () => {
    const store = makeStore()
    store.getState().observabilityStore.setAutoRefreshIntervalMs(15_000)
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBe(15_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/store/observability.store.test.ts
```

Expected: FAIL with `autoRefreshIntervalMs is not a function` or similar.

- [ ] **Step 3: Update the store**

Edit `src/store/observability.store.ts`:

Replace
```ts
autoRefresh: boolean // poll every 30s when range is "now"-anchored
```
with
```ts
autoRefreshIntervalMs: number | null // poll interval in ms; null = off
```

Replace
```ts
setAutoRefresh: (b: boolean) => void
```
with
```ts
setAutoRefreshIntervalMs: (ms: number | null) => void
```

Replace the initial value
```ts
autoRefresh: true,
```
with
```ts
autoRefreshIntervalMs: 30_000,
```

Replace the action
```ts
setAutoRefresh: (autoRefresh) =>
  set((s) => ({ observabilityStore: { ...s.observabilityStore, autoRefresh } })),
```
with
```ts
setAutoRefreshIntervalMs: (autoRefreshIntervalMs) =>
  set((s) => ({ observabilityStore: { ...s.observabilityStore, autoRefreshIntervalMs } })),
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/store/observability.store.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Fix consumers — `MetricsToolbar`**

Edit `src/modules/observability/MetricsToolbar.tsx`. The current `<Switch>` block (lines 59–65) references `observabilityStore.autoRefresh` and `setAutoRefresh`. Leave the Switch in place temporarily but wire to the new interval — Task 2 will replace it with the dropdown:

Replace
```tsx
<Switch
  checked={observabilityStore.autoRefresh}
  onCheckedChange={observabilityStore.setAutoRefresh}
/>
```
with
```tsx
<Switch
  checked={observabilityStore.autoRefreshIntervalMs != null}
  onCheckedChange={(on) => observabilityStore.setAutoRefreshIntervalMs(on ? 30_000 : null)}
/>
```

- [ ] **Step 6: Find and fix any remaining consumers**

```
grep -rn "autoRefresh\b" /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui/src
```

For each match outside `observability.store.ts` and `MetricsToolbar.tsx`, replace boolean uses with `autoRefreshIntervalMs != null`. If `useMetricsQuery` polls based on `autoRefresh`, update it to use the interval.

- [ ] **Step 7: Run full test suite**

```
pnpm test:run
```

Expected: all green. If something broke that wasn't covered by the grep, fix it.

- [ ] **Step 8: Commit**

```
git add src/store/observability.store.ts src/store/observability.store.test.ts src/modules/observability/MetricsToolbar.tsx src/hooks/useMetricsQuery.ts
git commit -m "feat(obs): replace autoRefresh boolean with autoRefreshIntervalMs"
```

---

## Task 2: AutoRefreshControl component

**Why:** Replaces the `<Switch>` in `MetricsToolbar` with a dropdown matching the design (`off · 15s · 30s · 60s`). Persists user choice across sessions.

**Files:**
- Create: `src/modules/observability/AutoRefreshControl.tsx`
- Create: `src/modules/observability/AutoRefreshControl.test.tsx`
- Modify: `src/modules/observability/MetricsToolbar.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/AutoRefreshControl.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoRefreshControl } from './AutoRefreshControl'

// Test must reset the zustand store between cases; the easiest way is to mock
// useStore. The real component reads observabilityStore.autoRefreshIntervalMs
// and calls setAutoRefreshIntervalMs.
const setAutoRefreshIntervalMs = vi.fn()
let currentInterval: number | null = 30_000

vi.mock('@/src/store', () => ({
  useStore: () => ({
    observabilityStore: {
      get autoRefreshIntervalMs() {
        return currentInterval
      },
      setAutoRefreshIntervalMs,
    },
  }),
}))

describe('AutoRefreshControl', () => {
  beforeEach(() => {
    currentInterval = 30_000
    setAutoRefreshIntervalMs.mockReset()
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('renders the current interval label', () => {
    render(<AutoRefreshControl />)
    expect(screen.getByRole('combobox')).toHaveTextContent('30s')
  })

  it('selecting "off" calls setAutoRefreshIntervalMs(null)', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /off/i }))
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(null)
  })

  it('selecting "15s" calls setAutoRefreshIntervalMs(15000)', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /15s/i }))
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(15_000)
  })

  it('persists selection to localStorage', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /60s/i }))
    expect(window.localStorage.getItem('obs.autoRefreshIntervalMs.v1')).toBe('60000')
  })

  it('restores selection from localStorage on mount', () => {
    window.localStorage.setItem('obs.autoRefreshIntervalMs.v1', '15000')
    render(<AutoRefreshControl />)
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(15_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/AutoRefreshControl.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the component**

Create `src/modules/observability/AutoRefreshControl.tsx`:

```tsx
'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { useStore } from '@/src/store'

const LS_KEY = 'obs.autoRefreshIntervalMs.v1'

const OPTIONS: { label: string; value: number | null }[] = [
  { label: 'off', value: null },
  { label: '15s', value: 15_000 },
  { label: '30s', value: 30_000 },
  { label: '60s', value: 60_000 },
]

function valueToString(v: number | null): string {
  return v == null ? 'off' : String(v)
}

function stringToValue(s: string): number | null {
  return s === 'off' ? null : Number(s)
}

export function AutoRefreshControl() {
  const { observabilityStore } = useStore()

  // Restore last selection on mount.
  React.useEffect(() => {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw == null) return
    const v = raw === 'null' ? null : Number(raw)
    if (v !== observabilityStore.autoRefreshIntervalMs) {
      observabilityStore.setAutoRefreshIntervalMs(v)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (s: string) => {
    const v = stringToValue(s)
    observabilityStore.setAutoRefreshIntervalMs(v)
    window.localStorage.setItem(LS_KEY, v == null ? 'null' : String(v))
  }

  return (
    <Select
      value={valueToString(observabilityStore.autoRefreshIntervalMs)}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[88px] h-7 caption-1" aria-label="Auto-refresh interval">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.label} value={valueToString(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/AutoRefreshControl.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Replace the Switch in `MetricsToolbar`**

Edit `src/modules/observability/MetricsToolbar.tsx`. Replace lines 59–65 (the `<label>` wrapping `<Switch>`):

Before:
```tsx
<label className="flex items-center gap-1.5 caption-1 text-[var(--text-secondary)]">
  Auto-refresh
  <Switch
    checked={observabilityStore.autoRefreshIntervalMs != null}
    onCheckedChange={(on) => observabilityStore.setAutoRefreshIntervalMs(on ? 30_000 : null)}
  />
</label>
```

After:
```tsx
<AutoRefreshControl />
```

And remove the unused `Switch` import from the top of the file.

Add the import:
```tsx
import { AutoRefreshControl } from './AutoRefreshControl'
```

- [ ] **Step 6: Run full test suite**

```
pnpm test:run
```

Expected: all green.

- [ ] **Step 7: Commit**

```
git add src/modules/observability/AutoRefreshControl.tsx src/modules/observability/AutoRefreshControl.test.tsx src/modules/observability/MetricsToolbar.tsx
git commit -m "feat(obs): add AutoRefreshControl dropdown (off/15s/30s/60s)"
```

---

## Task 3: StatusPill component

**Why:** Toolbar chip showing `internal stack · 1.4 GB · 7d` from `/ui-api/observability/stack`. Lets engineers see the operational stack state without navigating to /workspace/observability.

**Files:**
- Create: `src/modules/observability/StatusPill.tsx`
- Create: `src/modules/observability/StatusPill.test.tsx`
- Modify: `src/modules/observability/MetricsToolbar.tsx`
- Modify: `src/modules/observability/LogsToolbar.tsx`

> **Actual stack route response shape** (verified 2026-05-12 — see `src/app/ui-api/observability/stack/route.ts`):
> ```ts
> type ObservabilityStackResponse = {
>   vmsingle: {
>     version: string | null
>     retention: string                 // e.g. "7d", from VM_RETENTION env
>     diskUsageBytes: number | null     // from vm_data_size_bytes query
>     diskQuotaBytes: number | null
>   }
>   victoriaLogs: {
>     version: string | null
>     retention: string
>     diskUsageBytes: number | null
>     diskQuotaBytes: number | null
>   }
>   fanOut: { ... }
>   cardinality: Array<{ ... }>
> }
> ```
> **The route already exists and returns retention + disk usage.** Task 3 is a pure frontend task — no backend changes needed. StatusPill reads `data.vmsingle.retention`, `data.vmsingle.diskUsageBytes`, `data.victoriaLogs.retention`, `data.victoriaLogs.diskUsageBytes` from this nested shape.

- [ ] **Step 1: SKIP — stack route already exists with required fields**

- [ ] **Step 2: SKIP — no backend changes needed**

- [ ] **Step 3: Write the failing test**

Create `src/modules/observability/StatusPill.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { StatusPill } from './StatusPill'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StatusPill', () => {
  it('renders nothing while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<StatusPill />)
    expect(container.firstChild).toBeNull()
  })

  it('renders retention info on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        vmsingle: { version: null, retention: '7d', diskUsageBytes: 1_500_000_000, diskQuotaBytes: null },
        victoriaLogs: { version: null, retention: '3d', diskUsageBytes: 4_700_000_000, diskQuotaBytes: null },
        fanOut: { collectorEndpoint: null, external: [] },
        cardinality: [],
      }),
    })
    render(<StatusPill />)
    await waitFor(() =>
      expect(screen.getByText(/internal stack/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/7d/)).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
  })

  it('renders nothing when the stack route errors out', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const { container } = render(<StatusPill />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/StatusPill.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 5: Implement the component**

Create `src/modules/observability/StatusPill.tsx`:

```tsx
'use client'

import * as React from 'react'
import type { ObservabilityStackResponse } from '@/src/app/ui-api/observability/stack/route'

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || !Number.isFinite(bytes)) return null
  const gb = bytes / 1_000_000_000
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / 1_000_000
  return `${mb.toFixed(0)} MB`
}

export function StatusPill() {
  const [info, setInfo] = React.useState<ObservabilityStackResponse | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/ui-api/observability/stack')
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const data = (await res.json()) as ObservabilityStackResponse
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error || !info) return null

  const disk = formatBytes(info.vmsingle?.diskUsageBytes)
  const metricsRetention = info.vmsingle?.retention
  const logsRetention = info.victoriaLogs?.retention
  const parts: string[] = ['internal stack']
  if (disk) parts.push(disk)
  if (metricsRetention) parts.push(`${metricsRetention} / ${logsRetention ?? '—'}`)

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface-bg)] border border-[var(--surface-border)] caption-2 mono-2 text-[var(--text-secondary)]"
      aria-label="Internal observability stack status"
    >
      {parts.join(' · ')}
    </span>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/StatusPill.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 7: Wire into `MetricsToolbar`**

Edit `src/modules/observability/MetricsToolbar.tsx`. Add the import:
```tsx
import { StatusPill } from './StatusPill'
```

In the JSX, replace the right-side toolbar block:
```tsx
<div className="flex items-center gap-3">
  <AutoRefreshControl />
  <TimeRangePicker ... />
</div>
```

with:
```tsx
<div className="flex items-center gap-3">
  <StatusPill />
  <AutoRefreshControl />
  <TimeRangePicker ... />
</div>
```

- [ ] **Step 8: Wire into `LogsToolbar`**

Edit `src/modules/observability/LogsToolbar.tsx`. Add the import:
```tsx
import { StatusPill } from './StatusPill'
```

Place `<StatusPill />` in the right-side block of the upper toolbar row (where `TimeRangePicker` lives):
```tsx
<div className="flex items-center gap-2">
  <StatusPill />
  <TimeRangePicker ... />
  <Button ...>Pause/Resume</Button>
</div>
```

- [ ] **Step 9: Run full test suite + visual check**

```
pnpm test:run
pnpm dev
```

Open `/pipelines/<id>/metrics` in a browser. Confirm the status pill renders without breaking layout.

- [ ] **Step 10: Commit**

```
git add src/modules/observability/StatusPill.tsx src/modules/observability/StatusPill.test.tsx src/modules/observability/MetricsToolbar.tsx src/modules/observability/LogsToolbar.tsx src/app/ui-api/observability/stack/route.ts
git commit -m "feat(obs): add StatusPill to metrics and logs toolbars"
```

---

## Task 4: ScopingNoteBanner component

**Why:** Renders a dismissible orange note explaining `pipeline_id` scoping on the metrics dashboard, per the design's bottom-of-page NOTE. Reinforces the "this is your pipeline only" guarantee.

**Files:**
- Create: `src/modules/observability/ScopingNoteBanner.tsx`
- Create: `src/modules/observability/ScopingNoteBanner.test.tsx`
- Modify: `src/modules/observability/MetricsTab.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/ScopingNoteBanner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopingNoteBanner } from './ScopingNoteBanner'

describe('ScopingNoteBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('renders the scoping note', () => {
    render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    expect(screen.getByText(/pipeline_id/i)).toBeInTheDocument()
  })

  it('hides itself after dismiss and remembers the dismissal', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/pipeline_id/i)).toBeNull()
    unmount()

    render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    expect(screen.queryByText(/pipeline_id/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/ScopingNoteBanner.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the component**

Create `src/modules/observability/ScopingNoteBanner.tsx`:

```tsx
'use client'

import * as React from 'react'
import { X as XIcon } from 'lucide-react'

const LS_KEY = 'obs.scopingNoteDismissed.v1'

type Props = { pipelineId: string }

export function ScopingNoteBanner({ pipelineId }: Props) {
  const [hidden, setHidden] = React.useState(false)

  React.useEffect(() => {
    if (window.localStorage.getItem(LS_KEY) === '1') setHidden(true)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    window.localStorage.setItem(LS_KEY, '1')
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 px-4 py-3 rounded-md border border-[var(--color-foreground-primary-faded)] bg-[var(--color-orange-alpha-10)]"
    >
      <span className="caption-1 mono-2 text-[var(--color-foreground-primary)] shrink-0 pt-0.5">
        NOTE
      </span>
      <p className="caption-1 text-[var(--text-secondary)] flex-1">
        Every chart on this page is read from VictoriaMetrics with an enforced{' '}
        <code className="mono-2 text-[var(--text-primary)]">
          pipeline_id=&quot;{pipelineId}&quot;
        </code>{' '}
        label. Metrics from other pipelines are never queryable from this view.
      </p>
      <button
        type="button"
        aria-label="Dismiss scoping note"
        onClick={dismiss}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/ScopingNoteBanner.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `MetricsTab` + add the missing DisabledState guard**

Edit `src/modules/observability/MetricsTab.tsx`. Add imports:
```tsx
import { ScopingNoteBanner } from './ScopingNoteBanner'
import { DisabledState } from './DisabledState'
import { useObservabilityFlag } from '@/src/hooks/useObservabilityFlag'
```

`LogsTab` already short-circuits to `<DisabledState surface="logs" />` when the flag is off. `MetricsTab` does not — add the same guard at the top of the function:

```tsx
export function MetricsTab({ pipelineId }: MetricsTabProps) {
  const enabled = useObservabilityFlag()
  const selectedComponents = useSelectedMetricsComponents()  // added in Task 6

  if (!enabled) {
    return <DisabledState surface="metrics" />
  }

  return (
    // ... existing JSX
  )
}
```

Then add the banner above the chart grid (after the hero card grid):
```tsx
<MetricsToolbar pipelineId={pipelineId} />

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {HERO_CARDS.map(...)}
</div>

<ScopingNoteBanner pipelineId={pipelineId} />

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {CHART_GRID.map(...)}
</div>
```

Note: `useSelectedMetricsComponents` doesn't exist yet — it's created in Task 5/6. Either reorder tasks or stub the call with `[]` here and re-thread in Task 6. Stub for now.

- [ ] **Step 6: Run full test suite**

```
pnpm test:run
```

Expected: all green.

- [ ] **Step 7: Commit**

```
git add src/modules/observability/ScopingNoteBanner.tsx src/modules/observability/ScopingNoteBanner.test.tsx src/modules/observability/MetricsTab.tsx
git commit -m "feat(obs): add ScopingNoteBanner to metrics dashboard"
```

---

## Task 5: MetricsComponentFilter component

**Why:** Design's metrics toolbar shows `BY COMPONENT [ingestor] [processor] [sink]` pills. This filters which series the dashboard charts render. Reuses `FilterPillRow`.

**Files:**
- Create: `src/modules/observability/MetricsComponentFilter.tsx`
- Create: `src/modules/observability/MetricsComponentFilter.test.tsx`
- Modify: `src/modules/observability/MetricsToolbar.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/MetricsComponentFilter.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricsComponentFilter } from './MetricsComponentFilter'

const setUrl = vi.fn()
let urlValue: string[] = []

vi.mock('@/src/hooks/useUrlState', () => ({
  useUrlStateArray: (_key: string, _default: string[]) => [urlValue, setUrl] as const,
  useUrlState: () => ['', vi.fn()] as const,
}))

describe('MetricsComponentFilter', () => {
  beforeEach(() => {
    urlValue = []
    setUrl.mockReset()
  })
  afterEach(() => cleanup())

  it('renders three component pills', () => {
    render(<MetricsComponentFilter />)
    expect(screen.getByRole('button', { name: /ingestor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /processor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sink/i })).toBeInTheDocument()
  })

  it('toggling a pill writes to the URL', async () => {
    const user = userEvent.setup()
    render(<MetricsComponentFilter />)
    await user.click(screen.getByRole('button', { name: /ingestor/i }))
    expect(setUrl).toHaveBeenCalledWith(['ingestor'])
  })

  it('un-toggling a pill removes it from the URL', async () => {
    urlValue = ['ingestor', 'sink']
    const user = userEvent.setup()
    render(<MetricsComponentFilter />)
    await user.click(screen.getByRole('button', { name: /ingestor/i }))
    expect(setUrl).toHaveBeenCalledWith(['sink'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/MetricsComponentFilter.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the component**

Create `src/modules/observability/MetricsComponentFilter.tsx`:

```tsx
'use client'

import { FilterPillRow } from './FilterPillRow'
import { useUrlStateArray } from '@/src/hooks/useUrlState'

export const METRICS_COMPONENTS = ['ingestor', 'processor', 'sink'] as const
export type MetricsComponent = (typeof METRICS_COMPONENTS)[number]

const SWATCHES: Record<MetricsComponent, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

export function MetricsComponentFilter() {
  const [selected, setSelected] = useUrlStateArray('comp', [])

  const toggle = (k: string) => {
    setSelected(
      selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k],
    )
  }

  return (
    <FilterPillRow<MetricsComponent>
      label="Component"
      options={[...METRICS_COMPONENTS]}
      counts={{}}
      selected={selected as MetricsComponent[]}
      onToggle={toggle}
      swatchColors={SWATCHES}
    />
  )
}

/**
 * Read the current component selection without rendering the filter UI.
 * Consumers (MetricsTab → ChartCard) call this to know what to render.
 */
export function useSelectedMetricsComponents(): MetricsComponent[] {
  const [selected] = useUrlStateArray('comp', [])
  // Empty selection = show all
  return selected.length === 0
    ? [...METRICS_COMPONENTS]
    : (selected as MetricsComponent[])
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/MetricsComponentFilter.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `MetricsToolbar`**

Edit `src/modules/observability/MetricsToolbar.tsx`. Add the import:
```tsx
import { MetricsComponentFilter } from './MetricsComponentFilter'
```

Restructure the JSX to wrap in a column layout so the component filter sits below the badges row:
```tsx
return (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <ScopeBadge pipelineId={pipelineId} />
        <BrushedRangePill />
      </div>
      <div className="flex items-center gap-3">
        <StatusPill />
        <AutoRefreshControl />
        <TimeRangePicker ... />
      </div>
    </div>
    <MetricsComponentFilter />
    <CustomDateRangeModal ... />
  </div>
)
```

- [ ] **Step 6: Run full test suite**

```
pnpm test:run
```

Expected: all green.

- [ ] **Step 7: Commit**

```
git add src/modules/observability/MetricsComponentFilter.tsx src/modules/observability/MetricsComponentFilter.test.tsx src/modules/observability/MetricsToolbar.tsx
git commit -m "feat(obs): add component filter pills to metrics toolbar"
```

---

## Task 6: Multi-series upgrade to `ChartCard`

**Why:** `ChartCard` currently renders only `series[0]`. The design's "Records ingested · by component" panel shows multiple component lines. Also: needs to honor the new `MetricsComponentFilter` selection.

**Files:**
- Modify: `src/modules/observability/ChartCard.tsx`
- Create: `src/modules/observability/ChartCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/ChartCard.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChartCard } from './ChartCard'

const mockData = {
  promql: 'rate(...)',
  query: 'records_ingested',
  result: {
    status: 'success',
    result: [
      {
        metric: { component: 'ingestor' },
        values: [
          [1, '100'],
          [2, '110'],
        ] as [number, string][],
      },
      {
        metric: { component: 'processor' },
        values: [
          [1, '80'],
          [2, '90'],
        ] as [number, string][],
      },
      {
        metric: { component: 'sink' },
        values: [
          [1, '70'],
          [2, '75'],
        ] as [number, string][],
      },
    ],
  },
}

afterEach(() => cleanup())

describe('ChartCard multi-series', () => {
  it('renders one <Line /> per component in the response', () => {
    const { container } = render(
      <ChartCard title="Records ingested" query="rate(...)" data={mockData as any} loading={false} />,
    )
    // Recharts renders <path className="recharts-line-curve"> per Line.
    const lines = container.querySelectorAll('.recharts-line')
    expect(lines.length).toBe(3)
  })

  it('filters series when selectedComponents prop is set', () => {
    const { container } = render(
      <ChartCard
        title="Records ingested"
        query="rate(...)"
        data={mockData as any}
        loading={false}
        selectedComponents={['ingestor']}
      />,
    )
    const lines = container.querySelectorAll('.recharts-line')
    expect(lines.length).toBe(1)
  })

  it('falls back to a single series when no component label is present', () => {
    const { container } = render(
      <ChartCard
        title="x"
        query="x"
        loading={false}
        data={{
          promql: 'x',
          query: 'x',
          result: {
            status: 'success',
            result: [
              { metric: {}, values: [[1, '5'] as [number, string]] },
            ],
          },
        } as any}
      />,
    )
    expect(container.querySelectorAll('.recharts-line').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/ChartCard.test.tsx
```

Expected: FAIL — current ChartCard renders only one Line.

- [ ] **Step 3: Update `ChartCard.tsx`**

Replace the body of `src/modules/observability/ChartCard.tsx` with:

```tsx
'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import type { MetricResult } from '@/src/hooks/useMetricsQuery'
import { useStore } from '@/src/store'

type ChartCardProps = {
  title: string
  query: string
  data: MetricResult | undefined
  error?: Error
  loading: boolean
  height?: number
  enableBrush?: boolean
  /** When set, only these components are rendered. Empty/undefined = all. */
  selectedComponents?: string[]
}

const COMPONENT_COLORS: Record<string, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

const FALLBACK_COLOR = 'var(--color-foreground-primary)'

export function ChartCard({
  title,
  query,
  data,
  error,
  loading,
  height = 180,
  enableBrush = true,
  selectedComponents,
}: ChartCardProps) {
  const { observabilityStore } = useStore()
  const seriesArray = data?.result?.result ?? []

  // Build a pivot table: each row = one timestamp, each column = one component.
  const { points, components } = React.useMemo(() => {
    const filter =
      selectedComponents && selectedComponents.length > 0
        ? new Set(selectedComponents)
        : null
    const filtered = seriesArray.filter((s) => {
      const comp = (s.metric.component ?? 'all') as string
      return !filter || filter.has(comp)
    })
    const tsSet = new Set<number>()
    for (const s of filtered) for (const v of s.values) tsSet.add(v[0])
    const ts = Array.from(tsSet).sort((a, b) => a - b)
    const rows = ts.map((t) => {
      const row: Record<string, number | undefined> = { t: t * 1000 }
      for (const s of filtered) {
        const comp = (s.metric.component ?? 'all') as string
        const found = s.values.find((v) => v[0] === t)
        row[comp] = found ? parseFloat(found[1]) : undefined
      }
      return row
    })
    const comps = Array.from(new Set(filtered.map((s) => (s.metric.component ?? 'all') as string)))
    return { points: rows, components: comps }
  }, [seriesArray, selectedComponents])

  const state: ChartFrameState = loading
    ? 'loading'
    : error
      ? 'error'
      : points.length === 0
        ? 'empty'
        : 'populated'

  const [brushStart, setBrushStart] = React.useState<number | null>(null)
  const [brushEnd, setBrushEnd] = React.useState<number | null>(null)

  return (
    <ChartFrame
      title={title}
      subline={<span title={query}>{query.length > 64 ? `${query.slice(0, 64)}…` : query}</span>}
      state={state}
      errorMessage={error?.message}
      height={height}
    >
      <ResponsiveContainer>
        <LineChart
          data={points}
          margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
          onMouseDown={(e: { activeLabel?: number | string } | null) => {
            if (!enableBrush) return
            if (e?.activeLabel != null) setBrushStart(Number(e.activeLabel))
          }}
          onMouseMove={(e: { activeLabel?: number | string } | null) => {
            if (!enableBrush) return
            if (brushStart != null && e?.activeLabel != null) {
              setBrushEnd(Number(e.activeLabel))
            }
          }}
          onMouseUp={() => {
            if (
              enableBrush &&
              brushStart != null &&
              brushEnd != null &&
              brushStart !== brushEnd
            ) {
              const fromMs = Math.min(brushStart, brushEnd)
              const toMs = Math.max(brushStart, brushEnd)
              observabilityStore.pinBrushedRange({ fromMs, toMs }, 'metrics_drill_down')
            }
            setBrushStart(null)
            setBrushEnd(null)
          }}
          onMouseLeave={() => {
            setBrushStart(null)
            setBrushEnd(null)
          }}
        >
          <CartesianGrid stroke="var(--obs-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{
              fill: 'var(--obs-chart-axis)',
              fontSize: 10,
              fontFamily: 'var(--font-family-mono)',
            }}
            tickFormatter={(t: number) => new Date(t).toLocaleTimeString()}
          />
          <YAxis
            tick={{
              fill: 'var(--obs-chart-axis)',
              fontSize: 10,
              fontFamily: 'var(--font-family-mono)',
            }}
            width={36}
          />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
            contentStyle={{
              background: 'var(--color-background-elevation-overlay)',
              border: '1px solid var(--surface-border)',
            }}
          />
          {components.length > 1 && <Legend />}
          {components.map((c) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              stroke={COMPONENT_COLORS[c] ?? FALLBACK_COLOR}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          {brushStart != null && brushEnd != null && (
            <ReferenceArea
              x1={brushStart}
              x2={brushEnd}
              fill="var(--color-foreground-primary)"
              fillOpacity={0.15}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/ChartCard.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Thread `selectedComponents` through `MetricsTab`**

Edit `src/modules/observability/MetricsTab.tsx`. Add import:
```tsx
import { useSelectedMetricsComponents } from './MetricsComponentFilter'
```

Inside `MetricsTab`, read the selection:
```tsx
export function MetricsTab({ pipelineId }: MetricsTabProps) {
  const selectedComponents = useSelectedMetricsComponents()
  // ...
}
```

Pass to each chart card:
```tsx
<ChartCard ... selectedComponents={selectedComponents} />
```

- [ ] **Step 6: Run full test suite**

```
pnpm test:run
```

Expected: all green.

- [ ] **Step 7: Commit**

```
git add src/modules/observability/ChartCard.tsx src/modules/observability/ChartCard.test.tsx src/modules/observability/MetricsTab.tsx
git commit -m "feat(obs): multi-series ChartCard + component filter threading"
```

---

## Task 7: DLQPeekPanel + shared `useDLQActions` hook

**Why:** Adds the dashboard DLQ peek panel. Refactors the duplicate consume/purge logic so peek and viewer share state.

**Files:**
- Create: `src/hooks/useDLQActions.ts`
- Create: `src/modules/observability/DLQPeekPanel.tsx`
- Create: `src/modules/observability/DLQPeekPanel.test.tsx`
- Modify: `src/modules/observability/DLQViewer.tsx` (refactor to use the hook)

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useDLQActions.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDLQActions } from './useDLQActions'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('useDLQActions', () => {
  it('fetches state on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 47, size: 12_000 }),
    })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toEqual({ count: 47, size: 12_000 }))
    expect(fetchMock).toHaveBeenCalledWith('/ui-api/pipeline/abc/dlq/state')
  })

  it('consume() POSTs and refetches state', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 47 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ consumed: 100 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toBeTruthy())
    await act(async () => {
      await result.current.consume(100)
    })
    expect(result.current.actionMessage).toMatch(/consumed/i)
    expect(result.current.state?.count).toBe(0)
  })

  it('purge() DELETEs and refetches state', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 47 }) })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toBeTruthy())
    await act(async () => {
      await result.current.purge()
    })
    expect(result.current.state?.count).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/hooks/useDLQActions.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useDLQActions.ts`:

```ts
'use client'

import * as React from 'react'

export type DLQState = { count: number; size?: number }

type UseDLQActionsReturn = {
  state: DLQState | null
  loading: boolean
  error: string | null
  actionMessage: string | null
  consuming: boolean
  refetch: () => Promise<void>
  consume: (batchSize: number) => Promise<void>
  purge: () => Promise<void>
}

export function useDLQActions(pipelineId: string): UseDLQActionsReturn {
  const [state, setState] = React.useState<DLQState | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [consuming, setConsuming] = React.useState(false)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/state`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Failed to fetch DLQ state')
        return
      }
      const data = await res.json()
      setState(data?.data ?? data)
      setError(null)
    } catch {
      setError('Failed to fetch DLQ state')
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  const consume = React.useCallback(
    async (batchSize: number) => {
      setConsuming(true)
      setActionMessage(null)
      try {
        const res = await fetch(
          `/ui-api/pipeline/${pipelineId}/dlq/consume?batch_size=${batchSize}`,
        )
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setActionMessage(`Consumed ${data?.consumed ?? batchSize} events.`)
          await refetch()
        } else {
          setActionMessage(data?.error ?? 'Consume failed')
        }
      } catch {
        setActionMessage('Consume failed')
      } finally {
        setConsuming(false)
      }
    },
    [pipelineId, refetch],
  )

  const purge = React.useCallback(async () => {
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/purge`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActionMessage('Error queue cleared.')
        await refetch()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionMessage(data?.error ?? 'Purge failed')
      }
    } catch {
      setActionMessage('Purge failed')
    }
  }, [pipelineId, refetch])

  return { state, loading, error, actionMessage, consuming, refetch, consume, purge }
}
```

- [ ] **Step 4: Run hook test to verify it passes**

```
pnpm vitest run src/hooks/useDLQActions.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `DLQViewer` to use the hook**

Edit `src/modules/observability/DLQViewer.tsx`. Replace the body — keep the JSX shape, swap the state management:

```tsx
'use client'

import { useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Input } from '@/src/components/ui/input'
import { useDLQActions } from '@/src/hooks/useDLQActions'
import dynamic from 'next/dynamic'

const FlushDLQModal = dynamic(
  () => import('@/src/modules/pipelines/components/FlushDLQModal'),
  { ssr: false },
)

interface DLQViewerProps {
  pipelineId: string
}

export function DLQViewer({ pipelineId }: DLQViewerProps) {
  const { state, loading, error, actionMessage, consuming, consume, purge } =
    useDLQActions(pipelineId)
  const [batchSize, setBatchSize] = useState(100)
  const [showPurgeModal, setShowPurgeModal] = useState(false)

  const count = state?.count ?? 0

  return (
    <Card variant="dark" className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="title-5 text-[var(--text-primary)]">Dead Letter Queue</h3>
        {!loading && (
          <Badge variant={count > 0 ? 'error' : 'secondary'}>
            {count} {count === 1 ? 'event' : 'events'}
          </Badge>
        )}
      </div>

      {loading && <p className="body-3 text-[var(--text-secondary)]">Loading…</p>}
      {error && !loading && (
        <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>
      )}
      {!loading && !error && count === 0 && (
        <p className="body-3 text-[var(--text-secondary)]">No failed events in queue.</p>
      )}

      {!loading && !error && count > 0 && (
        <div className="flex items-center gap-2">
          <label className="caption-1 text-[var(--text-secondary)] shrink-0">
            Batch size
          </label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={batchSize}
            onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 100))}
            className="w-20 h-7"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => consume(batchSize)}
            loading={consuming}
            loadingText="Consuming…"
          >
            Consume
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowPurgeModal(true)}>
            Purge all
          </Button>
        </div>
      )}

      {actionMessage && (
        <p className="caption-1 text-[var(--text-secondary)]">{actionMessage}</p>
      )}

      {showPurgeModal && (
        <FlushDLQModal
          visible={showPurgeModal}
          onOk={() => {
            setShowPurgeModal(false)
            purge()
          }}
          onCancel={() => setShowPurgeModal(false)}
        />
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Write the failing DLQPeekPanel test**

Create `src/modules/observability/DLQPeekPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { DLQPeekPanel } from './DLQPeekPanel'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DLQPeekPanel', () => {
  it('renders count badge from state endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 47 }),
    })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText('47')).toBeInTheDocument())
    expect(screen.getByText(/events/i)).toBeInTheDocument()
  })

  it('renders Open DLQ viewer link pointing to /dlq', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 5 }) })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open dlq viewer/i })).toHaveAttribute(
        'href',
        expect.stringContaining('abc'),
      ),
    )
  })

  it('shows the Open viewer link even when count is zero', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() =>
      expect(screen.getByText(/no failed events/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /open dlq viewer/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/DLQPeekPanel.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 8: Implement DLQPeekPanel**

Create `src/modules/observability/DLQPeekPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { useDLQActions } from '@/src/hooks/useDLQActions'

const FlushDLQModal = dynamic(
  () => import('@/src/modules/pipelines/components/FlushDLQModal'),
  { ssr: false },
)

type Props = { pipelineId: string }

export function DLQPeekPanel({ pipelineId }: Props) {
  const { state, loading, error, actionMessage, consuming, consume, purge } =
    useDLQActions(pipelineId)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const count = state?.count ?? 0

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-3 flex flex-col gap-3 min-h-[180px]">
      <div className="flex items-center justify-between">
        <span className="caption-1 text-[var(--text-secondary)]">Dead-letter queue</span>
        {!loading && !error && (
          <Badge variant={count > 0 ? 'error' : 'secondary'}>
            {count} {count === 1 ? 'event' : 'events'}
          </Badge>
        )}
      </div>

      <div className="flex-1">
        {loading && <p className="caption-1 text-[var(--text-tertiary)]">Loading…</p>}
        {error && !loading && (
          <p className="caption-1 text-[var(--color-foreground-critical)]">{error}</p>
        )}
        {!loading && !error && count === 0 && (
          <p className="caption-1 text-[var(--text-tertiary)]">No failed events in queue.</p>
        )}
        {!loading && !error && count > 0 && (
          <p className="caption-1 text-[var(--text-secondary)]">
            {count} {count === 1 ? 'message has' : 'messages have'} been routed to the DLQ.
            Open the viewer to inspect them.
          </p>
        )}
        {actionMessage && (
          <p className="caption-1 text-[var(--text-secondary)] mt-2">{actionMessage}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/pipelines/${pipelineId}/dlq`}>Open DLQ viewer →</Link>
        </Button>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => consume(100)}
              loading={consuming}
              loadingText="Consuming…"
            >
              Consume 100
            </Button>
          )}
          {count > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowPurgeModal(true)}>
              Purge…
            </Button>
          )}
        </div>
      </div>

      {showPurgeModal && (
        <FlushDLQModal
          visible={showPurgeModal}
          onOk={() => {
            setShowPurgeModal(false)
            purge()
          }}
          onCancel={() => setShowPurgeModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 9: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/DLQPeekPanel.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 10: Verify the DLQ route from peek**

Confirm the route `/pipelines/[id]/dlq` exists or wire it: it should mount `<DLQViewer pipelineId={id} />`. Check via:

```
ls src/app/\(shell\)/pipelines/\[id\]/dlq 2>/dev/null
```

If missing, create `src/app/(shell)/pipelines/[id]/dlq/page.tsx`:

```tsx
import { DLQViewer } from '@/src/modules/observability/DLQViewer'

export default async function DLQPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="p-4">
      <DLQViewer pipelineId={id} />
    </div>
  )
}
```

- [ ] **Step 11: Run full test suite**

```
pnpm test:run
```

- [ ] **Step 12: Commit**

```
git add src/hooks/useDLQActions.ts src/hooks/useDLQActions.test.ts src/modules/observability/DLQViewer.tsx src/modules/observability/DLQPeekPanel.tsx src/modules/observability/DLQPeekPanel.test.tsx src/app/\(shell\)/pipelines/\[id\]/dlq/page.tsx
git commit -m "feat(obs): add DLQ peek panel + shared useDLQActions hook"
```

---

## Task 8: Wire DLQPeekPanel into the metrics dashboard

**Why:** Slot the peek panel into the dashboard grid so users see the DLQ status alongside throughput / latency.

**Files:**
- Modify: `src/modules/observability/canonicalDashboard.ts`
- Modify: `src/modules/observability/MetricsTab.tsx`

- [ ] **Step 1: Reduce chart grid from 6 to 5 cells**

The design shows DLQ peek occupying one cell in the chart grid. We drop `consumer_lag` to make room — five throughput/latency/errors charts plus a DLQ peek cell, matching the design's layout.

- [ ] **Step 2: Update `canonicalDashboard.ts`**

Edit `src/modules/observability/canonicalDashboard.ts`. Remove `consumer_lag` from `CHART_GRID` (or replace with another metric if desired — leaving the call here for a designer):

```ts
export const CHART_GRID: ChartSpec[] = [
  { key: 'records_ingested', title: 'Records ingested', unit: 'rec/s' },
  { key: 'records_processed', title: 'Records processed', unit: 'rec/s' },
  { key: 'records_sunk', title: 'Records sunk', unit: 'rec/s' },
  { key: 'latency_p95', title: 'Latency p95', unit: 's' },
  { key: 'errors_total', title: 'Errors', unit: '/s' },
  // DLQ peek panel takes this cell (rendered in MetricsTab outside CHART_GRID)
]
```

- [ ] **Step 3: Wire DLQPeekPanel into `MetricsTab.tsx`**

Edit `src/modules/observability/MetricsTab.tsx`. Add the import:

```tsx
import { DLQPeekPanel } from './DLQPeekPanel'
```

Update the chart grid block to render the DLQ peek as the last cell:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {CHART_GRID.map((spec) => (
    <Link
      key={spec.key}
      href={`/pipelines/${pipelineId}/metrics/${spec.key}`}
      className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-foreground-primary)] rounded-md"
    >
      <ChartCardSlot pipelineId={pipelineId} spec={spec} />
    </Link>
  ))}
  <DLQPeekPanel pipelineId={pipelineId} />
</div>
```

- [ ] **Step 4: Run full test suite + visual check**

```
pnpm test:run
pnpm dev
```

Open `/pipelines/<id>/metrics` and confirm:
- Toolbar shows scope badge + status pill + auto-refresh dropdown + range picker
- Component filter pills appear below
- 3 hero cards render
- Scoping NOTE banner appears below hero cards
- 5 charts + DLQ peek in the grid (6 cells total)

- [ ] **Step 5: Commit**

```
git add src/modules/observability/canonicalDashboard.ts src/modules/observability/MetricsTab.tsx
git commit -m "feat(obs): slot DLQPeekPanel into metrics dashboard grid"
```

---

## Task 9: OBChartSVG primitive — base rendering + crosshair

**Why:** The drill-down view (Task 11) needs a polished SVG chart with crosshair on hover. This task ships the base chart without brush; brush is Task 10.

**Files:**
- Create: `src/modules/observability/primitives/OBChartSVG.tsx`
- Create: `src/modules/observability/primitives/OBChartSVG.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/primitives/OBChartSVG.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OBChartSVG } from './OBChartSVG'

const series = [
  {
    id: 'ingestor',
    color: 'var(--obs-chart-ingestor)',
    points: [
      [1_700_000_000_000, 100],
      [1_700_000_060_000, 110],
      [1_700_000_120_000, 105],
    ] as Array<[number, number]>,
  },
]

afterEach(() => cleanup())

describe('OBChartSVG base rendering', () => {
  it('renders one <path> per series', () => {
    const { container } = render(
      <OBChartSVG series={series} width={400} height={200} />,
    )
    const paths = container.querySelectorAll('path[data-series-id]')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('data-series-id')).toBe('ingestor')
  })

  it('renders y-axis labels', () => {
    const { container } = render(
      <OBChartSVG series={series} width={400} height={200} />,
    )
    const labels = container.querySelectorAll('text[data-axis="y"]')
    expect(labels.length).toBeGreaterThanOrEqual(3)
  })

  it('shows crosshair on mouse move when showCrosshair=true', () => {
    const { container } = render(
      <OBChartSVG series={series} width={400} height={200} showCrosshair />,
    )
    const svg = container.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    const crosshair = container.querySelector('[data-crosshair]')
    expect(crosshair).not.toBeNull()
  })

  it('does not render crosshair when showCrosshair is unset', () => {
    const { container } = render(
      <OBChartSVG series={series} width={400} height={200} />,
    )
    const svg = container.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    expect(container.querySelector('[data-crosshair]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/primitives/OBChartSVG.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement OBChartSVG (base + crosshair, no brush yet)**

Create `src/modules/observability/primitives/OBChartSVG.tsx`:

```tsx
'use client'

import * as React from 'react'

export type OBSeries = {
  id: string
  color: string
  points: Array<[ms: number, v: number]>
  dashed?: boolean
  fill?: string
}

export type OBChartSVGProps = {
  series: OBSeries[]
  yMax?: number
  yMin?: number
  width?: number
  height?: number
  pad?: { l: number; r: number; t: number; b: number }
  showCrosshair?: boolean
  showBrush?: boolean
  brushFromMs?: number | null
  brushToMs?: number | null
  onBrushChange?: (fromMs: number, toMs: number) => void
  onBrushClear?: () => void
}

const DEFAULT_PAD = { l: 36, r: 8, t: 8, b: 22 }

export function OBChartSVG({
  series,
  yMax,
  yMin,
  width = 800,
  height = 320,
  pad = DEFAULT_PAD,
  showCrosshair = false,
}: OBChartSVGProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const [hoverX, setHoverX] = React.useState<number | null>(null)

  const allTs: number[] = []
  const allVs: number[] = []
  for (const s of series) {
    for (const [t, v] of s.points) {
      allTs.push(t)
      if (Number.isFinite(v)) allVs.push(v)
    }
  }
  const tMin = Math.min(...allTs)
  const tMax = Math.max(...allTs)
  const vMin = yMin ?? Math.min(...allVs)
  const vMax = yMax ?? Math.max(...allVs)
  const vRange = vMax - vMin || 1

  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  const xScale = (t: number) => pad.l + ((t - tMin) / (tMax - tMin || 1)) * plotW
  const yScale = (v: number) => pad.t + plotH - ((v - vMin) / vRange) * plotH

  // Y gridlines + axis labels (5 ticks)
  const yTicks = React.useMemo(() => {
    const ticks: number[] = []
    for (let i = 0; i <= 4; i++) ticks.push(vMin + (vRange * i) / 4)
    return ticks
  }, [vMin, vRange])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!showCrosshair) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < pad.l || x > pad.l + plotW) {
      setHoverX(null)
      return
    }
    setHoverX(x)
  }

  const handleMouseLeave = () => setHoverX(null)

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'block' }}
      role="img"
      aria-label="Time series chart"
    >
      {/* Y gridlines */}
      {yTicks.map((v, i) => {
        const y = yScale(v)
        return (
          <g key={`yt-${i}`}>
            <line
              x1={pad.l}
              x2={pad.l + plotW}
              y1={y}
              y2={y}
              stroke="var(--obs-chart-grid)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              data-axis="y"
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--obs-chart-axis)"
              fontFamily="var(--font-family-mono)"
              fontSize={10}
            >
              {formatYTick(v)}
            </text>
          </g>
        )
      })}

      {/* X axis baseline */}
      <line
        x1={pad.l}
        x2={pad.l + plotW}
        y1={pad.t + plotH}
        y2={pad.t + plotH}
        stroke="var(--obs-chart-axis)"
        strokeWidth={1}
      />

      {/* Series lines */}
      {series.map((s) => (
        <path
          key={s.id}
          data-series-id={s.id}
          d={pathFromPoints(s.points, xScale, yScale)}
          stroke={s.color}
          strokeWidth={1.5}
          strokeDasharray={s.dashed ? '4 3' : undefined}
          fill="none"
        />
      ))}

      {/* Crosshair */}
      {hoverX != null && (
        <line
          data-crosshair=""
          x1={hoverX}
          x2={hoverX}
          y1={pad.t}
          y2={pad.t + plotH}
          stroke="var(--color-foreground-primary)"
          strokeDasharray="3 3"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
    </svg>
  )
}

function pathFromPoints(
  points: Array<[number, number]>,
  xScale: (t: number) => number,
  yScale: (v: number) => number,
): string {
  if (points.length === 0) return ''
  return points
    .map(([t, v], i) => `${i === 0 ? 'M' : 'L'} ${xScale(t).toFixed(2)} ${yScale(v).toFixed(2)}`)
    .join(' ')
}

function formatYTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  if (v < 1 && v > 0) return v.toFixed(2)
  return Math.round(v).toString()
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/primitives/OBChartSVG.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add src/modules/observability/primitives/OBChartSVG.tsx src/modules/observability/primitives/OBChartSVG.test.tsx
git commit -m "feat(obs): add OBChartSVG primitive with crosshair (base rendering)"
```

---

## Task 10: OBChartSVG — brush region + drag interactions + keyboard

**Why:** Add the brush UX so the drill-down view can pin a range.

**Files:**
- Modify: `src/modules/observability/primitives/OBChartSVG.tsx`
- Modify: `src/modules/observability/primitives/OBChartSVG.test.tsx`

- [ ] **Step 1: Add failing brush tests**

Append to `src/modules/observability/primitives/OBChartSVG.test.tsx`:

```tsx
describe('OBChartSVG brush', () => {
  it('mousedown + mousemove + mouseup fires onBrushChange with ms values', () => {
    const onBrushChange = vi.fn()
    const { container } = render(
      <OBChartSVG
        series={series}
        width={400}
        height={200}
        showBrush
        onBrushChange={onBrushChange}
      />,
    )
    const svg = container.querySelector('svg')!
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(svg, { clientX: 200, clientY: 100 })
    expect(onBrushChange).toHaveBeenCalledTimes(1)
    const [fromMs, toMs] = onBrushChange.mock.calls[0]
    expect(typeof fromMs).toBe('number')
    expect(typeof toMs).toBe('number')
    expect(fromMs).toBeLessThan(toMs)
  })

  it('renders a brush rectangle when brushFromMs/toMs are set', () => {
    const { container } = render(
      <OBChartSVG
        series={series}
        width={400}
        height={200}
        showBrush
        brushFromMs={1_700_000_030_000}
        brushToMs={1_700_000_090_000}
      />,
    )
    expect(container.querySelector('rect[data-brush-region]')).not.toBeNull()
  })

  it('arrow key on focused svg nudges brush when brush is set', () => {
    const onBrushChange = vi.fn()
    const { container } = render(
      <OBChartSVG
        series={series}
        width={400}
        height={200}
        showBrush
        brushFromMs={1_700_000_030_000}
        brushToMs={1_700_000_090_000}
        onBrushChange={onBrushChange}
      />,
    )
    const svg = container.querySelector('svg')!
    svg.focus()
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(onBrushChange).toHaveBeenCalled()
  })
})
```

Add `vi` to imports if not already:
```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
```

- [ ] **Step 2: Run test to verify the brush tests fail**

```
pnpm vitest run src/modules/observability/primitives/OBChartSVG.test.tsx
```

Expected: brush tests FAIL.

- [ ] **Step 3: Implement brush + keyboard**

Edit `src/modules/observability/primitives/OBChartSVG.tsx`. Replace the `OBChartSVG` function body with a version that adds brush state and handlers. Use the structure below — keep the existing rendering code and add what's between BRUSH-BEGIN and BRUSH-END markers:

Full replacement of the `OBChartSVG` function:

```tsx
export function OBChartSVG({
  series,
  yMax,
  yMin,
  width = 800,
  height = 320,
  pad = DEFAULT_PAD,
  showCrosshair = false,
  showBrush = false,
  brushFromMs = null,
  brushToMs = null,
  onBrushChange,
  onBrushClear,
}: OBChartSVGProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const [hoverX, setHoverX] = React.useState<number | null>(null)
  const [dragStartMs, setDragStartMs] = React.useState<number | null>(null)
  const [dragCurrentMs, setDragCurrentMs] = React.useState<number | null>(null)

  const allTs: number[] = []
  const allVs: number[] = []
  for (const s of series) {
    for (const [t, v] of s.points) {
      allTs.push(t)
      if (Number.isFinite(v)) allVs.push(v)
    }
  }
  const tMin = Math.min(...allTs)
  const tMax = Math.max(...allTs)
  const vMin = yMin ?? Math.min(...allVs)
  const vMax = yMax ?? Math.max(...allVs)
  const vRange = vMax - vMin || 1
  const tRange = tMax - tMin || 1

  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  const xScale = (t: number) => pad.l + ((t - tMin) / tRange) * plotW
  const yScale = (v: number) => pad.t + plotH - ((v - vMin) / vRange) * plotH
  const xToMs = (x: number) => tMin + ((x - pad.l) / plotW) * tRange

  const yTicks = React.useMemo(() => {
    const ticks: number[] = []
    for (let i = 0; i <= 4; i++) ticks.push(vMin + (vRange * i) / 4)
    return ticks
  }, [vMin, vRange])

  const clampX = (x: number) => Math.min(pad.l + plotW, Math.max(pad.l, x))

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (showCrosshair) {
      setHoverX(x < pad.l || x > pad.l + plotW ? null : x)
    }
    if (showBrush && dragStartMs != null) {
      setDragCurrentMs(xToMs(clampX(x)))
    }
  }

  const handleMouseLeave = () => {
    setHoverX(null)
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!showBrush) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < pad.l || x > pad.l + plotW) return
    setDragStartMs(xToMs(x))
    setDragCurrentMs(xToMs(x))
  }

  const handleMouseUp = () => {
    if (!showBrush) return
    if (dragStartMs != null && dragCurrentMs != null && dragStartMs !== dragCurrentMs) {
      const fromMs = Math.min(dragStartMs, dragCurrentMs)
      const toMs = Math.max(dragStartMs, dragCurrentMs)
      onBrushChange?.(fromMs, toMs)
    }
    setDragStartMs(null)
    setDragCurrentMs(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!showBrush || brushFromMs == null || brushToMs == null) return
    const step = (brushToMs - brushFromMs) * 0.05
    if (e.key === 'ArrowRight') {
      onBrushChange?.(brushFromMs + step, brushToMs + step)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      onBrushChange?.(brushFromMs - step, brushToMs - step)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      onBrushClear?.()
      e.preventDefault()
    }
  }

  // Visible brush — either the in-progress drag or the controlled prop.
  const activeFrom =
    dragStartMs != null && dragCurrentMs != null
      ? Math.min(dragStartMs, dragCurrentMs)
      : brushFromMs
  const activeTo =
    dragStartMs != null && dragCurrentMs != null
      ? Math.max(dragStartMs, dragCurrentMs)
      : brushToMs

  return (
    <svg
      ref={svgRef}
      tabIndex={showBrush ? 0 : -1}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      style={{ display: 'block', outline: 'none' }}
      role="img"
      aria-label="Time series chart"
    >
      {yTicks.map((v, i) => {
        const y = yScale(v)
        return (
          <g key={`yt-${i}`}>
            <line
              x1={pad.l}
              x2={pad.l + plotW}
              y1={y}
              y2={y}
              stroke="var(--obs-chart-grid)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              data-axis="y"
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--obs-chart-axis)"
              fontFamily="var(--font-family-mono)"
              fontSize={10}
            >
              {formatYTick(v)}
            </text>
          </g>
        )
      })}

      <line
        x1={pad.l}
        x2={pad.l + plotW}
        y1={pad.t + plotH}
        y2={pad.t + plotH}
        stroke="var(--obs-chart-axis)"
        strokeWidth={1}
      />

      {/* Brush region */}
      {activeFrom != null && activeTo != null && (
        <rect
          data-brush-region=""
          x={xScale(activeFrom)}
          y={pad.t}
          width={Math.max(1, xScale(activeTo) - xScale(activeFrom))}
          height={plotH}
          fill="var(--color-foreground-primary)"
          fillOpacity={0.13}
          stroke="var(--color-foreground-primary)"
          strokeOpacity={0.6}
          strokeWidth={1}
        />
      )}

      {series.map((s) => (
        <path
          key={s.id}
          data-series-id={s.id}
          d={pathFromPoints(s.points, xScale, yScale)}
          stroke={s.color}
          strokeWidth={1.5}
          strokeDasharray={s.dashed ? '4 3' : undefined}
          fill="none"
        />
      ))}

      {hoverX != null && (
        <line
          data-crosshair=""
          x1={hoverX}
          x2={hoverX}
          y1={pad.t}
          y2={pad.t + plotH}
          stroke="var(--color-foreground-primary)"
          strokeDasharray="3 3"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
    </svg>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm vitest run src/modules/observability/primitives/OBChartSVG.test.tsx
```

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```
git add src/modules/observability/primitives/OBChartSVG.tsx src/modules/observability/primitives/OBChartSVG.test.tsx
git commit -m "feat(obs): add brush + keyboard support to OBChartSVG"
```

---

## Task 11: DrillDownView upgrade — replace Recharts with OBChartSVG

**Why:** The drill-down is the "investigating an incident" surface where UX quality matters most. Switch from bare Recharts to `OBChartSVG` with brush wired to the store.

**Files:**
- Modify: `src/modules/observability/DrillDownView.tsx`
- Create: `src/modules/observability/DrillDownView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/modules/observability/DrillDownView.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DrillDownView } from './DrillDownView'

const pinBrushedRange = vi.fn()
const clearBrushedRange = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: () => ({
    observabilityStore: {
      rangeKey: '1h',
      customRange: null,
      brushedRange: null,
      autoRefreshIntervalMs: 30_000,
      setRangeKey: vi.fn(),
      setCustomRange: vi.fn(),
      pinBrushedRange,
      clearBrushedRange,
      setAutoRefreshIntervalMs: vi.fn(),
    },
  }),
}))

vi.mock('@/src/hooks/useMetricsQuery', () => ({
  useMetricsQuery: () => ({
    data: {
      promql: 'rate(...)',
      query: 'records_ingested',
      result: {
        status: 'success',
        result: [
          {
            metric: { component: 'ingestor' },
            values: [
              [1_700_000_000, '100'],
              [1_700_000_060, '110'],
              [1_700_000_120, '120'],
            ] as [number, string][],
          },
        ],
      },
    },
    error: null,
    isLoading: false,
  }),
}))

beforeEach(() => {
  pinBrushedRange.mockReset()
  clearBrushedRange.mockReset()
})
afterEach(() => cleanup())

describe('DrillDownView with OBChartSVG', () => {
  it('renders the back-to-metrics link', () => {
    render(<DrillDownView pipelineId="abc" queryKey="records_ingested" />)
    expect(screen.getByRole('link', { name: /back to metrics/i })).toBeInTheDocument()
  })

  it('renders an OBChartSVG (not a Recharts LineChart)', () => {
    const { container } = render(
      <DrillDownView pipelineId="abc" queryKey="records_ingested" />,
    )
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    expect(container.querySelector('.recharts-wrapper')).toBeNull()
  })

  it('mouse-drag on the chart calls pinBrushedRange', () => {
    const { container } = render(
      <DrillDownView pipelineId="abc" queryKey="records_ingested" />,
    )
    const svg = container.querySelector('svg[role="img"]')!
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(svg, { clientX: 200, clientY: 100 })
    expect(pinBrushedRange).toHaveBeenCalled()
    const [range, source] = pinBrushedRange.mock.calls[0]
    expect(source).toBe('metrics_drill_down')
    expect(range.fromMs).toBeLessThan(range.toMs)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/DrillDownView.test.tsx
```

Expected: FAIL — DrillDownView still uses Recharts.

- [ ] **Step 3: Rewrite DrillDownView using OBChartSVG**

Replace `src/modules/observability/DrillDownView.tsx`:

```tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { OBChartSVG, type OBSeries } from './primitives/OBChartSVG'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import { MetricsToolbar } from './MetricsToolbar'
import { useMetricsQuery } from '@/src/hooks/useMetricsQuery'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'

const COMPONENT_COLORS: Record<string, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}
const FALLBACK_COLOR = 'var(--color-foreground-primary)'

type DrillDownViewProps = {
  pipelineId: string
  queryKey: CanonicalQueryKey
}

export function DrillDownView({ pipelineId, queryKey }: DrillDownViewProps) {
  const { observabilityStore } = useStore()
  const { data, error, isLoading } = useMetricsQuery(pipelineId, queryKey)
  const rawSeries = data?.result?.result ?? []

  const obSeries: OBSeries[] = React.useMemo(
    () =>
      rawSeries.map((s) => {
        const comp = (s.metric.component ?? 'all') as string
        return {
          id: comp,
          color: COMPONENT_COLORS[comp] ?? FALLBACK_COLOR,
          points: s.values.map(([t, v]) => [t * 1000, parseFloat(v)] as [number, number]),
        }
      }),
    [rawSeries],
  )

  const state: ChartFrameState = isLoading
    ? 'loading'
    : error
      ? 'error'
      : obSeries.length === 0
        ? 'empty'
        : 'populated'

  const brushed = observabilityStore.brushedRange

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/pipelines/${pipelineId}/metrics`}
          className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
        >
          ← back to metrics
        </Link>
        <div className="flex items-center gap-2">
          {brushed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => observabilityStore.clearBrushedRange()}
            >
              Clear brush
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/pipelines/${pipelineId}/logs`}>Open logs in range →</Link>
          </Button>
        </div>
      </div>

      <MetricsToolbar pipelineId={pipelineId} />

      <ChartFrame
        title={queryKey}
        state={state}
        errorMessage={error?.message}
        height={420}
      >
        <div className="w-full h-full">
          <OBChartSVG
            series={obSeries}
            width={1580}
            height={400}
            showCrosshair
            showBrush
            brushFromMs={brushed?.fromMs ?? null}
            brushToMs={brushed?.toMs ?? null}
            onBrushChange={(fromMs, toMs) =>
              observabilityStore.pinBrushedRange({ fromMs, toMs }, 'metrics_drill_down')
            }
            onBrushClear={() => observabilityStore.clearBrushedRange()}
          />
        </div>
      </ChartFrame>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/DrillDownView.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run full test suite + visual check**

```
pnpm test:run
pnpm dev
```

Open `/pipelines/<id>/metrics/records_ingested` in a browser. Confirm:
- Chart renders as SVG (not Recharts)
- Mouse hover shows crosshair
- Click-and-drag creates an orange brush region
- After releasing, the BrushedRangePill in the toolbar shows the pinned range
- Clicking "Clear brush" removes it

- [ ] **Step 6: Commit**

```
git add src/modules/observability/DrillDownView.tsx src/modules/observability/DrillDownView.test.tsx
git commit -m "feat(obs): replace Recharts with OBChartSVG in DrillDownView"
```

---

## Task 12: DrillDownView correlation panels + Copy LogsQL

**Why:** Below the main chart, show two correlation panels — latency p99 in the brushed window, and a count of logs by component in the same window. Plus a "Copy LogsQL" button so power users can carry the query elsewhere.

**Files:**
- Modify: `src/modules/observability/DrillDownView.tsx`
- Create: `src/modules/observability/LogsInRangePanel.tsx`
- Create: `src/modules/observability/LogsInRangePanel.test.tsx`

- [ ] **Step 1: Write the failing test for `LogsInRangePanel`**

> **Hook contract reminder:** `useLogsQuery(pipelineId, query, opts?: { skip?, limit? })` does NOT accept `fromMs`/`toMs` — the range comes from `useMetricsRange()` internally, which already returns the brushed range when one is pinned (see `src/hooks/useMetricsRange.ts` lines 36–43). So `LogsInRangePanel` doesn't need range props; just call the hook while the brush is active.

Create `src/modules/observability/LogsInRangePanel.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { LogsInRangePanel } from './LogsInRangePanel'

vi.mock('@/src/hooks/useLogsQuery', () => ({
  useLogsQuery: () => ({
    data: {
      query: '',
      count: 5,
      lines: [
        { _time: '1', component: 'ingestor', severity: 'info', _msg: 'ok' },
        { _time: '2', component: 'ingestor', severity: 'error', _msg: 'boom' },
        { _time: '3', component: 'processor', severity: 'warn', _msg: 'slow' },
        { _time: '4', component: 'processor', severity: 'error', _msg: 'fail' },
        { _time: '5', component: 'sink', severity: 'info', _msg: 'ok' },
      ],
    },
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}))

afterEach(() => cleanup())

describe('LogsInRangePanel', () => {
  it('renders a component breakdown of error/warn counts', async () => {
    render(<LogsInRangePanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText(/ingestor/i)).toBeInTheDocument())
    expect(screen.getByText(/processor/i)).toBeInTheDocument()
    expect(screen.getByText(/sink/i)).toBeInTheDocument()
  })

  it('shows the total line count', async () => {
    render(<LogsInRangePanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText(/5 lines/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm vitest run src/modules/observability/LogsInRangePanel.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement `LogsInRangePanel`**

Create `src/modules/observability/LogsInRangePanel.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useLogsQuery } from '@/src/hooks/useLogsQuery'

type Props = {
  pipelineId: string
}

type ComponentSummary = {
  total: number
  errors: number
  warns: number
}

/**
 * Render a component breakdown of logs for whatever range is currently
 * active in observabilityStore. When called from DrillDownView this is the
 * brushed range (since `useMetricsRange` prioritises `brushedRange`).
 */
export function LogsInRangePanel({ pipelineId }: Props) {
  const { data, isLoading, error } = useLogsQuery(pipelineId, '')
  const lines = data?.lines ?? []

  const summary = React.useMemo<Record<string, ComponentSummary>>(() => {
    const acc: Record<string, ComponentSummary> = {}
    for (const l of lines) {
      const comp = String(l.component ?? 'unknown')
      acc[comp] ??= { total: 0, errors: 0, warns: 0 }
      acc[comp].total += 1
      const sev = String(l.severity ?? '').toLowerCase()
      if (sev === 'error' || sev === 'fatal') acc[comp].errors += 1
      else if (sev === 'warn' || sev === 'warning') acc[comp].warns += 1
    }
    return acc
  }, [lines])

  const components = Object.keys(summary)

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="caption-1 text-[var(--text-secondary)]">Logs in this range</span>
        <span className="caption-1 mono-2 text-[var(--text-tertiary)]">
          {isLoading ? 'querying…' : `${lines.length} lines`}
        </span>
      </div>
      {error && (
        <p className="caption-1 text-[var(--color-foreground-critical)]">{error.message}</p>
      )}
      {!isLoading && !error && (
        <ul className="flex flex-col gap-1.5">
          {components.map((c) => {
            const s = summary[c]
            return (
              <li key={c} className="flex items-center justify-between caption-1 mono-2">
                <span className="text-[var(--text-primary)]">{c}</span>
                <span className="text-[var(--text-tertiary)]">
                  <span className="text-[var(--color-foreground-critical)]">{s.errors}</span>
                  {' err · '}
                  <span className="text-[var(--obs-severity-warn)]">{s.warns}</span>
                  {' warn · '}
                  {s.total}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```


- [ ] **Step 4: Run test to verify it passes**

```
pnpm vitest run src/modules/observability/LogsInRangePanel.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Add correlation panels + Copy LogsQL to `DrillDownView`**

Edit `src/modules/observability/DrillDownView.tsx`. Add imports:

```tsx
import { LogsInRangePanel } from './LogsInRangePanel'
import { ChartCard } from './ChartCard'
```

After the main `<ChartFrame>` block, add a correlation panels row that renders only when a brush is active:

```tsx
{brushed && <CorrelationPanels pipelineId={pipelineId} />}
```

Define `CorrelationPanels` in the same file (top-level, outside the `DrillDownView` function):

```tsx
function CorrelationPanels({ pipelineId }: { pipelineId: string }) {
  // useMetricsQuery reads useMetricsRange() internally — when a brush is
  // pinned in the store, the latency query is auto-scoped to that window.
  const latency = useMetricsQuery(pipelineId, 'latency_p99' as const)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <ChartCard
        title="Latency p99 · same range"
        query="histogram_quantile(0.99, …)"
        data={latency.data}
        error={latency.error}
        loading={latency.isLoading}
        enableBrush={false}
        height={180}
      />
      <LogsInRangePanel pipelineId={pipelineId} />
    </div>
  )
}
```

Both `useMetricsQuery` and `useLogsQuery` read `useMetricsRange()` under the hood, which prioritises `observabilityStore.brushedRange` when set — so neither panel needs explicit range props.

Also add a `Copy LogsQL` button next to "Open logs in range" in the existing header row:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    const logsql = `_time:[${new Date(brushed?.fromMs ?? 0).toISOString()}, ${new Date(brushed?.toMs ?? 0).toISOString()}]`
    navigator.clipboard.writeText(logsql)
  }}
  disabled={!brushed}
>
  Copy LogsQL
</Button>
```

- [ ] **Step 6: Run full test suite**

```
pnpm test:run
```

- [ ] **Step 7: Commit**

```
git add src/modules/observability/DrillDownView.tsx src/modules/observability/LogsInRangePanel.tsx src/modules/observability/LogsInRangePanel.test.tsx
git commit -m "feat(obs): add correlation panels and Copy LogsQL to DrillDownView"
```

---

## Task 13: Smoke test — full cross-surface flow

**Why:** Ensure the click-spike → drill → brush → navigate-to-logs → see-pinned-range flow works end-to-end.

**Files:**
- Create: `src/modules/observability/__tests__/observability.smoke.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/modules/observability/__tests__/observability.smoke.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { createStore } from 'zustand/vanilla'
import { createObservabilitySlice, type ObservabilitySlice } from '@/src/store/observability.store'
import { DrillDownView } from '../DrillDownView'

// Wire useStore to a real (test) store so brush state actually flows.
let storeApi = createStore<ObservabilitySlice>()((set, get, api) =>
  createObservabilitySlice(set, get, api),
)

vi.mock('@/src/store', () => ({
  useStore: () => storeApi.getState(),
}))

vi.mock('@/src/hooks/useMetricsQuery', () => ({
  useMetricsQuery: () => ({
    data: {
      promql: 'rate(...)',
      query: 'records_ingested',
      result: {
        status: 'success',
        result: [
          {
            metric: { component: 'ingestor' },
            values: [
              [1_700_000_000, '100'],
              [1_700_000_060, '110'],
              [1_700_000_120, '120'],
            ] as [number, string][],
          },
        ],
      },
    },
    error: null,
    isLoading: false,
  }),
}))

vi.mock('@/src/hooks/useLogsQuery', () => ({
  useLogsQuery: () => ({ data: { lines: [] }, error: null, isLoading: false }),
}))

beforeEach(() => {
  storeApi = createStore<ObservabilitySlice>()((set, get, api) =>
    createObservabilitySlice(set, get, api),
  )
})
afterEach(() => cleanup())

describe('observability smoke flow', () => {
  it('brushing the drill-down chart pins a range in the store', async () => {
    const { container } = render(
      <DrillDownView pipelineId="abc" queryKey="records_ingested" />,
    )
    const svg = container.querySelector('svg[role="img"]')!
    expect(storeApi.getState().observabilityStore.brushedRange).toBeNull()
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 300, clientY: 100 })
    fireEvent.mouseUp(svg, { clientX: 300, clientY: 100 })
    await waitFor(() =>
      expect(storeApi.getState().observabilityStore.brushedRange).not.toBeNull(),
    )
    expect(storeApi.getState().observabilityStore.brushedRange?.source).toBe(
      'metrics_drill_down',
    )
  })
})
```

- [ ] **Step 2: Run the smoke test**

```
pnpm vitest run src/modules/observability/__tests__/observability.smoke.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 3: Run full test suite**

```
pnpm test:run
```

Expected: all green.

- [ ] **Step 4: Manual end-to-end verification**

```
pnpm dev
```

- Open `/pipelines/<existing-id>/metrics` — confirm new toolbar layout, component filter row, NOTE banner, DLQ peek slot, status pill all render
- Click any chart cell in the grid — should navigate to drill-down
- On the drill-down: drag horizontally on the SVG chart, release. Confirm:
  - Orange brush rectangle appears during drag
  - After release, the `BrushedRangePill` in the toolbar shows the pinned range
  - Correlation panels appear below the chart
- Click "Open logs in range →" — should navigate to `/pipelines/<id>/logs`
- On the logs tab: confirm `BrushedRangePill` shows the same pinned range, and logs are in range-query mode (not live tail)
- Click × on the pill — should return to live tail

- [ ] **Step 5: Commit**

```
git add src/modules/observability/__tests__/observability.smoke.test.tsx
git commit -m "test(obs): smoke test for drill-down brush → logs cross-surface flow"
```

---

## Wrap-up

After Task 13 completes:

- [ ] **Step 1: Final full test run**

```
pnpm test:run
```

- [ ] **Step 2: Type-check**

```
pnpm tsc --noEmit
```

Fix any TS errors that surface.

- [ ] **Step 3: Lint**

```
pnpm lint
```

- [ ] **Step 4: Confirm git log captures the Phase 1 work**

```
git log --oneline main..HEAD
```

Expected: ~13 commits, one per task, each commit message scoped `feat(obs):` / `test(obs):` / `docs:`.

- [ ] **Step 5: Open PR (when ready)**

The user will open the PR — do not push or open one automatically.

---

## Out of scope reminder

Phase 1 explicitly does **not** include:
- O5 search-with-context UX deepening (pinned-range chip integration into `MiniMetricsStrip`, "same shape" footer via `ContextClusterer`) → Phase 2
- O6 inspector drawer cross-cutting links (schema/trace/DLQ) → Phase 2
- Trace viewer UI (no current surface)
- Any work on `/observability` and `/workspace/observability` (already shipped O8 routes)
- Changes to the DLQ backend endpoints (`/dlq/state`, `/consume`, `/purge` already work)
- Cluster-wide metrics aggregation
- New design tokens — `--obs-chart-*` and `--obs-severity-*` already exist

If a task surfaces a need for any of the above, surface it as a follow-up issue rather than expanding the plan.
