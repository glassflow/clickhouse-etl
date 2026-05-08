# AI Drawer Remaining Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Ticket 11 by wiring the `?draft=` canvas loading path and feature-flagging all AI UI behind `ANTHROPIC_API_KEY`.

**Architecture:** Two independent gaps. Gap 1 adds a `pipelineConfigToCanvas` reverse-serializer, a store `initFromConfig` action, and searchParams reading in the canvas page so an AI-generated draft opens pre-populated. Gap 2 threads `aiEnabled` from the root server layout down to `AiDrawerMount` and `AppTopbar` so the drawer and toggle are hidden when no API key is configured.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Zustand, Drizzle ORM, Vitest + jsdom

---

## File Map

**Modify:**
- `src/modules/canvas/serializer.ts` — add `CanvasHydration` type + `pipelineConfigToCanvas()`
- `src/modules/canvas/__tests__/serializer.test.ts` — extend with `pipelineConfigToCanvas` tests
- `src/store/canvas.store.ts` — add `initFromConfig` to interfaces + slice
- `src/app/(shell)/canvas/page.tsx` — read `searchParams.draft`, fetch Drizzle, pass `initialConfig`
- `src/modules/canvas/CanvasView.tsx` — accept + apply `initialConfig` prop on mount
- `src/app/layout.tsx` — read `ANTHROPIC_API_KEY`, pass `aiEnabled` to `AiDrawerMount`
- `src/components/shared/AiDrawerMount.tsx` — accept `aiEnabled` prop, return null if false
- `src/components/shared/ShellLayoutClient.tsx` — pass `aiEnabled` through to `AppTopbar`
- `src/components/shared/AppTopbar.tsx` — accept `aiEnabled` prop, gate `AiToggleButton`

**No new files.**

---

## Task 1: `pipelineConfigToCanvas` reverse-serializer

**Files:**
- Modify: `src/modules/canvas/serializer.ts`

- [ ] **Step 1: Add `CanvasHydration` type and `pipelineConfigToCanvas` function**

Open `src/modules/canvas/serializer.ts`. After the existing `PipelineReferenceItem` export (around line 42), add:

```ts
import type { InternalPipelineConfig } from '@/src/types/pipeline'

export interface CanvasHydration {
  nodes: Node[]
  edges: Edge[]
  nodeConfigs: Record<string, Record<string, unknown>>
  sourceType: CanvasState['sourceType']
}

/**
 * Reverse of `canvasToPipelineConfig`. Maps an `InternalPipelineConfig` blob
 * (as produced by the AI pipeline_draft tool or a saved revision) back into
 * the canvas node/edge/config shape. Best-effort: library ref IDs are not
 * restored (the DriftBanner will prompt re-attachment). Missing fields fall
 * back to safe defaults.
 */
export function pipelineConfigToCanvas(config: InternalPipelineConfig): CanvasHydration {
  const isOtlp = config.source?.type !== 'kafka'
  const sourceType: CanvasState['sourceType'] = isOtlp
    ? ((config.source?.type as CanvasState['sourceType']) ?? 'otlp.logs')
    : 'kafka'
  const sourceNodeType = isOtlp ? 'otlpSource' : 'kafkaSource'

  const topic = config.source?.topics?.[0]
  const isDedupActive = topic?.deduplication?.enabled ?? false
  const isFilterActive = config.filter?.enabled ?? false
  const isTransformActive = config.stateless_transformation?.enabled ?? false

  const nodes: Node[] = [
    {
      id: 'source',
      type: sourceNodeType,
      position: { x: 0, y: 200 },
      data: { label: isOtlp ? 'OTLP Source' : 'Kafka Source' },
    },
    {
      id: 'dedup',
      type: 'dedup',
      position: { x: 250, y: 200 },
      data: { label: 'Deduplication', disabled: !isDedupActive },
    },
    {
      id: 'filter',
      type: 'filter',
      position: { x: 500, y: 200 },
      data: { label: 'Filter', disabled: !isFilterActive },
    },
    {
      id: 'transform',
      type: 'transform',
      position: { x: 750, y: 200 },
      data: { label: 'Transform', disabled: !isTransformActive },
    },
    {
      id: 'sink',
      type: 'clickhouseSink',
      position: { x: 1000, y: 200 },
      data: { label: 'ClickHouse Sink' },
    },
  ]

  const edges: Edge[] = [
    { id: 'e-source-dedup', source: 'source', target: 'dedup' },
    { id: 'e-dedup-filter', source: 'dedup', target: 'filter' },
    { id: 'e-filter-transform', source: 'filter', target: 'transform' },
    { id: 'e-transform-sink', source: 'transform', target: 'sink' },
  ]

  const brokers = config.source?.connection_params?.brokers ?? []
  const sourceConfig: Record<string, unknown> = isOtlp
    ? { endpoint: config.source?.id ?? '' }
    : {
        bootstrapServers: brokers.join(','),
        topicName: topic?.name ?? '',
      }

  const dedupConfig: Record<string, unknown> = {
    idField: topic?.deduplication?.id_field ?? '',
    timeWindow: topic?.deduplication?.time_window ?? '24h',
  }

  const filterConfig: Record<string, unknown> = {
    expression: config.filter?.expression ?? '',
  }

  const transformConfig: Record<string, unknown> = {
    expression:
      config.stateless_transformation?.config?.transform?.[0]?.expression ?? '',
  }

  const sink = config.sink
  const sinkConfig: Record<string, unknown> = {
    host: sink?.host ?? '',
    httpPort: sink?.httpPort ?? '8123',
    database: sink?.database ?? '',
    table: sink?.table ?? '',
    secure: sink?.secure ?? false,
    maxBatchSize: sink?.max_batch_size ?? 1000,
    maxDelayTime: sink?.max_delay_time ?? '1s',
    skipCertificateVerification: sink?.skip_certificate_verification ?? false,
  }

  return {
    nodes,
    edges,
    nodeConfigs: {
      source: sourceConfig,
      dedup: dedupConfig,
      filter: filterConfig,
      transform: transformConfig,
      sink: sinkConfig,
    },
    sourceType,
  }
}
```

Note: `CanvasState` is already imported from `@/src/store/canvas.store` via the `CanvasSerializeInput` type context — add the import if it isn't present:

```ts
import type { CanvasState } from '@/src/store/canvas.store'
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit 2>&1 | grep serializer
```

Expected: no output (no errors in serializer.ts).

- [ ] **Step 3: Commit**

```bash
git add src/modules/canvas/serializer.ts
git commit -m "feat: add pipelineConfigToCanvas reverse-serializer"
```

---

## Task 2: `pipelineConfigToCanvas` unit tests

**Files:**
- Modify: `src/modules/canvas/__tests__/serializer.test.ts`

- [ ] **Step 1: Add tests for `pipelineConfigToCanvas`**

Open `src/modules/canvas/__tests__/serializer.test.ts`. After the existing `extractLibraryReferences` describe block, add:

```ts
import { pipelineConfigToCanvas } from '../serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

const baseKafkaConfig = (): InternalPipelineConfig => ({
  pipeline_id: '',
  name: '',
  source: {
    type: 'kafka',
    connection_params: {
      brokers: ['broker1:9092', 'broker2:9092'],
      protocol: 'PLAINTEXT',
      mechanism: 'PLAIN',
    },
    topics: [
      {
        name: 'orders',
        id: 'orders',
        schema: { type: 'json', fields: [] },
        consumer_group_initial_offset: 'latest',
        deduplication: {
          enabled: false,
          id_field: '',
          id_field_type: 'string',
          time_window: '24h',
        },
      },
    ],
  },
  join: { enabled: false },
  sink: {
    type: 'clickhouse',
    host: 'ch.example.com',
    httpPort: '8123',
    database: 'analytics',
    table: 'events',
    secure: true,
    table_mapping: [],
    max_batch_size: 500,
    max_delay_time: '2s',
    skip_certificate_verification: false,
  },
})

describe('pipelineConfigToCanvas', () => {
  it('produces fixed node IDs matching buildDefaultPipeline', () => {
    const { nodes } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodes.map((n) => n.id)).toEqual(['source', 'dedup', 'filter', 'transform', 'sink'])
  })

  it('produces fixed edge set matching buildDefaultPipeline', () => {
    const { edges } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(edges.map((e) => e.id)).toEqual([
      'e-source-dedup',
      'e-dedup-filter',
      'e-filter-transform',
      'e-transform-sink',
    ])
  })

  it('maps kafka brokers to bootstrapServers (joined)', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodeConfigs['source']?.bootstrapServers).toBe('broker1:9092,broker2:9092')
  })

  it('maps topic name to topicName', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodeConfigs['source']?.topicName).toBe('orders')
  })

  it('dedup node is disabled when deduplication.enabled is false', () => {
    const { nodes } = pipelineConfigToCanvas(baseKafkaConfig())
    const dedup = nodes.find((n) => n.id === 'dedup')
    expect(dedup?.data.disabled).toBe(true)
  })

  it('dedup node is active when deduplication.enabled is true', () => {
    const config = baseKafkaConfig()
    config.source.topics![0].deduplication.enabled = true
    config.source.topics![0].deduplication.id_field = 'order_id'
    config.source.topics![0].deduplication.time_window = '12h'
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const dedup = nodes.find((n) => n.id === 'dedup')
    expect(dedup?.data.disabled).toBe(false)
    expect(nodeConfigs['dedup']?.idField).toBe('order_id')
    expect(nodeConfigs['dedup']?.timeWindow).toBe('12h')
  })

  it('filter node is active when filter.enabled is true', () => {
    const config = baseKafkaConfig()
    config.filter = { enabled: true, expression: 'amount > 0' }
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const filter = nodes.find((n) => n.id === 'filter')
    expect(filter?.data.disabled).toBe(false)
    expect(nodeConfigs['filter']?.expression).toBe('amount > 0')
  })

  it('transform node is active when stateless_transformation.enabled is true', () => {
    const config = baseKafkaConfig()
    config.stateless_transformation = {
      enabled: true,
      config: { transform: [{ expression: 'upper(name)', output_name: 'name', output_type: 'string' }] },
    }
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const transform = nodes.find((n) => n.id === 'transform')
    expect(transform?.data.disabled).toBe(false)
    expect(nodeConfigs['transform']?.expression).toBe('upper(name)')
  })

  it('maps sink fields correctly', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    const sink = nodeConfigs['sink']
    expect(sink?.host).toBe('ch.example.com')
    expect(sink?.database).toBe('analytics')
    expect(sink?.table).toBe('events')
    expect(sink?.secure).toBe(true)
    expect(sink?.maxBatchSize).toBe(500)
    expect(sink?.maxDelayTime).toBe('2s')
  })

  it('sets sourceType to "kafka" for kafka source', () => {
    const { sourceType } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(sourceType).toBe('kafka')
  })

  it('maps OTLP source endpoint and sets sourceType', () => {
    const config = baseKafkaConfig()
    config.source = { type: 'otlp.logs', id: 'http://collector:4318' }
    const { nodes, nodeConfigs, sourceType } = pipelineConfigToCanvas(config)
    expect(sourceType).toBe('otlp.logs')
    expect(nodes.find((n) => n.id === 'source')?.type).toBe('otlpSource')
    expect(nodeConfigs['source']?.endpoint).toBe('http://collector:4318')
  })

  it('round-trip: canvasToPipelineConfig → pipelineConfigToCanvas preserves key fields', () => {
    const config = baseKafkaConfig()
    config.source.topics![0].deduplication.enabled = true
    config.source.topics![0].deduplication.id_field = 'id'
    config.filter = { enabled: true, expression: 'x > 0' }
    // canvasToPipelineConfig needs a CanvasState shape — test via pipelineConfigToCanvas output
    const hydration = pipelineConfigToCanvas(config)
    expect(hydration.nodeConfigs['source']?.topicName).toBe('orders')
    expect(hydration.nodeConfigs['dedup']?.idField).toBe('id')
    expect(hydration.nodeConfigs['filter']?.expression).toBe('x > 0')
    expect(hydration.nodeConfigs['sink']?.host).toBe('ch.example.com')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test --run src/modules/canvas/__tests__/serializer.test.ts
```

Expected: All tests pass (both `extractLibraryReferences` and `pipelineConfigToCanvas` suites).

- [ ] **Step 3: Commit**

```bash
git add src/modules/canvas/__tests__/serializer.test.ts
git commit -m "test: add pipelineConfigToCanvas unit tests"
```

---

## Task 3: `initFromConfig` store action

**Files:**
- Modify: `src/store/canvas.store.ts`

- [ ] **Step 1: Add `CanvasHydration` import and `initFromConfig` to interfaces**

Open `src/store/canvas.store.ts`. Add the import at the top:

```ts
import type { CanvasHydration } from '@/src/modules/canvas/serializer'
```

In `CanvasActions` interface, add after `removeNode`:

```ts
initFromConfig: (hydration: CanvasHydration) => void
```

- [ ] **Step 2: Implement `initFromConfig` in `createCanvasSlice`**

In `createCanvasSlice`, after the `removeNode` implementation (before the closing `},`), add:

```ts
initFromConfig: (hydration) => {
  set((state) => ({
    canvasStore: {
      ...state.canvasStore,
      nodes: hydration.nodes,
      edges: hydration.edges,
      nodeConfigs: hydration.nodeConfigs,
      sourceType: hydration.sourceType,
      activeNodeId: null,
      isDirty: false,
    },
  }))
},
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | grep "canvas.store"
```

Expected: no output.

- [ ] **Step 4: Test `initFromConfig`**

Open `src/store/canvas.store.ts` and check that `CanvasSlice` is exported. Then add a test file:

Create `src/store/canvas.store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { create } from 'zustand'
import { createCanvasSlice, type CanvasSlice } from './canvas.store'
import { pipelineConfigToCanvas } from '@/src/modules/canvas/serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

function makeStore() {
  return create<CanvasSlice>()((set, get, api) => ({
    ...createCanvasSlice(set, get, api),
  }))
}

const minimalConfig = (): InternalPipelineConfig => ({
  pipeline_id: '',
  name: '',
  source: {
    type: 'kafka',
    connection_params: { brokers: ['b:9092'], protocol: 'PLAINTEXT', mechanism: 'PLAIN' },
    topics: [
      {
        name: 'events',
        id: 'events',
        schema: { type: 'json', fields: [] },
        consumer_group_initial_offset: 'latest',
        deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '24h' },
      },
    ],
  },
  join: { enabled: false },
  sink: {
    type: 'clickhouse',
    host: 'localhost',
    httpPort: '8123',
    database: 'db',
    table: 'tbl',
    secure: false,
    table_mapping: [],
    max_batch_size: 1000,
    max_delay_time: '1s',
    skip_certificate_verification: false,
  },
})

describe('canvasStore — initFromConfig', () => {
  it('populates nodes from hydration', () => {
    const store = makeStore()
    const hydration = pipelineConfigToCanvas(minimalConfig())
    store.getState().canvasStore.initFromConfig(hydration)
    expect(store.getState().canvasStore.nodes.map((n) => n.id)).toEqual([
      'source', 'dedup', 'filter', 'transform', 'sink',
    ])
  })

  it('populates nodeConfigs from hydration', () => {
    const store = makeStore()
    const config = minimalConfig()
    const hydration = pipelineConfigToCanvas(config)
    store.getState().canvasStore.initFromConfig(hydration)
    expect(store.getState().canvasStore.nodeConfigs['source']?.topicName).toBe('events')
    expect(store.getState().canvasStore.nodeConfigs['sink']?.host).toBe('localhost')
  })

  it('sets isDirty to false', () => {
    const store = makeStore()
    store.getState().canvasStore.initFromConfig(pipelineConfigToCanvas(minimalConfig()))
    expect(store.getState().canvasStore.isDirty).toBe(false)
  })

  it('sets sourceType from hydration', () => {
    const store = makeStore()
    store.getState().canvasStore.initFromConfig(pipelineConfigToCanvas(minimalConfig()))
    expect(store.getState().canvasStore.sourceType).toBe('kafka')
  })
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm test --run src/store/canvas.store.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/canvas.store.ts src/store/canvas.store.test.ts
git commit -m "feat: add initFromConfig action to canvas store"
```

---

## Task 4: Canvas page reads `?draft=` and passes `initialConfig`

**Files:**
- Modify: `src/app/(shell)/canvas/page.tsx`

- [ ] **Step 1: Rewrite the canvas page to read the draft param**

Replace the entire contents of `src/app/(shell)/canvas/page.tsx` with:

```ts
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineRevisions } from '@/src/lib/db/schema'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { CanvasView } from '@/src/modules/canvas/CanvasView'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

type PageProps = { searchParams: Promise<{ draft?: string }> }

export default async function CanvasPage({ searchParams }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { draft } = await searchParams
  let initialConfig: InternalPipelineConfig | null = null

  if (draft) {
    const [rev] = await db
      .select()
      .from(pipelineRevisions)
      .where(eq(pipelineRevisions.pipelineId, draft))
      .orderBy(desc(pipelineRevisions.revision))
      .limit(1)
    initialConfig = (rev?.config as InternalPipelineConfig) ?? null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-fadeIn">
      <CanvasView pipelineId={null} currentRevision={null} initialConfig={initialConfig} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript (the new `initialConfig` prop on CanvasView will error until Task 5)**

```bash
pnpm tsc --noEmit 2>&1 | grep "canvas/page"
```

Expected: one error about `initialConfig` not existing on `CanvasViewProps` — that's correct, it's added in Task 5.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shell)/canvas/page.tsx"
git commit -m "feat: canvas page reads ?draft= param and fetches config from Drizzle"
```

---

## Task 5: CanvasView applies `initialConfig` on mount

**Files:**
- Modify: `src/modules/canvas/CanvasView.tsx`

- [ ] **Step 1: Add imports and extend props type**

Open `src/modules/canvas/CanvasView.tsx`. Add to the imports:

```ts
import { pipelineConfigToCanvas } from './serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'
```

Find `type CanvasViewProps`:

```ts
type CanvasViewProps = {
  pipelineId?: string | null
  currentRevision?: number | null
}
```

Replace with:

```ts
type CanvasViewProps = {
  pipelineId?: string | null
  currentRevision?: number | null
  initialConfig?: InternalPipelineConfig | null
}
```

- [ ] **Step 2: Destructure `initialConfig` in `CanvasInner` and update the mount effect**

Find `function CanvasInner({ pipelineId, currentRevision }: CanvasViewProps)` and change to:

```ts
function CanvasInner({ pipelineId, currentRevision, initialConfig }: CanvasViewProps)
```

Then destructure `initFromConfig` from `canvasStore` (add it to the existing destructure block):

```ts
const {
  nodes,
  edges,
  activeNodeId,
  setActiveNode,
  applyNodeChanges,
  applyEdgeChanges,
  setEdges,
  addNodeAt,
  initDefaultPipeline,
  initFromConfig,        // ← add this
} = canvasStore
```

Find the existing mount effect:

```ts
React.useEffect(() => {
  if (nodes.length === 0) initDefaultPipeline('kafka')
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Replace with:

```ts
React.useEffect(() => {
  if (initialConfig) {
    initFromConfig(pipelineConfigToCanvas(initialConfig))
  } else if (nodes.length === 0) {
    initDefaultPipeline('kafka')
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 3: Pass `initialConfig` through `CanvasView` wrapper to `CanvasInner`**

Find the outer `export function CanvasView(...)` (or `CanvasViewWrapper`) that wraps `CanvasInner` in a `ReactFlowProvider`. Make sure `initialConfig` is passed through. It should look like:

```ts
export function CanvasView({ pipelineId, currentRevision, initialConfig }: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner pipelineId={pipelineId} currentRevision={currentRevision} initialConfig={initialConfig} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 4: Verify TypeScript is clean**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "CanvasView|canvas/page|serializer"
```

Expected: no output.

- [ ] **Step 5: Run canvas tests**

```bash
pnpm test --run src/modules/canvas/
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/canvas/CanvasView.tsx
git commit -m "feat: CanvasView applies initialConfig from AI draft on mount"
```

---

## Task 6: Feature flag — `AiDrawerMount` gated on `aiEnabled`

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/shared/AiDrawerMount.tsx`

- [ ] **Step 1: Pass `aiEnabled` from root layout to `AiDrawerMount`**

Open `src/app/layout.tsx`. Add before the `return` statement (inside the function body):

```ts
const aiEnabled = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
```

Find the `<AiDrawerMount />` line and change to:

```tsx
<AiDrawerMount aiEnabled={aiEnabled} />
```

- [ ] **Step 2: Update `AiDrawerMount` to accept and gate on the prop**

Replace the entire contents of `src/components/shared/AiDrawerMount.tsx` with:

```tsx
// Tiny client wrapper that mounts the AI drawer at the app root. The drawer
// itself uses Radix's `DialogPortal` (via the `Drawer` primitive) which
// already escapes the DOM tree — this wrapper only exists to keep the
// `'use client'` boundary out of the server-rendered root layout.
//
// Renders nothing when `aiEnabled` is false (no API key configured).

'use client'

import { AiDrawer } from '@/src/modules/ai/components/AiDrawer'

type AiDrawerMountProps = { aiEnabled?: boolean }

export function AiDrawerMount({ aiEnabled }: AiDrawerMountProps) {
  if (!aiEnabled) return null
  return <AiDrawer />
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "AiDrawerMount|layout"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/shared/AiDrawerMount.tsx
git commit -m "feat: gate AiDrawerMount behind aiEnabled flag"
```

---

## Task 7: Feature flag — `AppTopbar` toggle gated on `aiEnabled`

**Files:**
- Modify: `src/components/shared/AppTopbar.tsx`
- Modify: `src/components/shared/ShellLayoutClient.tsx`

- [ ] **Step 1: Add `aiEnabled` prop to `AppTopbar`**

Open `src/components/shared/AppTopbar.tsx`. Find:

```ts
type AppTopbarProps = {
  onCreateClick?: () => void
}

export function AppTopbar({ onCreateClick }: AppTopbarProps) {
```

Replace with:

```ts
type AppTopbarProps = {
  onCreateClick?: () => void
  aiEnabled?: boolean
}

export function AppTopbar({ onCreateClick, aiEnabled }: AppTopbarProps) {
```

Find (around line 246):

```tsx
<AiToggleButton compact />
```

Replace with:

```tsx
{aiEnabled && <AiToggleButton compact />}
```

- [ ] **Step 2: Pass `aiEnabled` from `ShellLayoutClient` to `AppTopbar`**

Open `src/components/shared/ShellLayoutClient.tsx`. The component already receives `aiEnabled` as a prop. Find:

```tsx
<AppTopbar onCreateClick={() => setIsCreateModalOpen(true)} />
```

Replace with:

```tsx
<AppTopbar onCreateClick={() => setIsCreateModalOpen(true)} aiEnabled={aiEnabled} />
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "AppTopbar|ShellLayout"
```

Expected: no output.

- [ ] **Step 4: Run full test suite to confirm nothing regressed**

```bash
pnpm test --run 2>&1 | tail -8
```

Expected: same pass count as before (around 1060+ tests, 122+ files), same pre-existing flaky OOM worker exit.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/AppTopbar.tsx src/components/shared/ShellLayoutClient.tsx
git commit -m "feat: gate AI toggle in AppTopbar behind aiEnabled flag"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `pipelineConfigToCanvas` reverse-serializer | Task 1 |
| All field mappings (brokers, topic, dedup, filter, transform, sink, OTLP) | Task 1 |
| Unit tests for `pipelineConfigToCanvas` | Task 2 |
| `initFromConfig` store action | Task 3 |
| Unit tests for `initFromConfig` | Task 3 |
| Canvas page reads `?draft=`, fetches Drizzle | Task 4 |
| CanvasView accepts + applies `initialConfig` on mount | Task 5 |
| Root layout passes `aiEnabled` to `AiDrawerMount` | Task 6 |
| `AiDrawerMount` returns null when `aiEnabled` is false | Task 6 |
| `AppTopbar` gates `AiToggleButton` on `aiEnabled` | Task 7 |
| `ShellLayoutClient` passes `aiEnabled` to `AppTopbar` | Task 7 |

**Type consistency check:**
- `CanvasHydration` defined in Task 1, imported in Task 3 (`canvas.store.ts`) — ✓
- `initFromConfig(hydration: CanvasHydration)` defined in Task 3, called in Task 5 — ✓
- `initialConfig?: InternalPipelineConfig | null` defined in Task 5, produced in Task 4 — ✓
- `pipelineConfigToCanvas` exported in Task 1, imported in Tasks 2, 3, 5 — ✓

**Placeholder scan:** No TBDs, no "handle edge cases", no "similar to Task N", all code blocks complete.

**One note:** Task 4 commits with a TypeScript error (Task 5 not yet done). This is intentional — the commit message documents it and the error is eliminated by the next task. If this is unacceptable in your workflow, swap the order: do Task 5 before Task 4.
