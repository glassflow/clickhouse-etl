# UI Architecture Revamp 2026 — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally transform the GlassFlow UI from a single linear wizard into a multi-lane composable platform (Wizard + Canvas + AI) with a shared component Library, a clean domain model, and a dedicated Observability section — without breaking existing functionality at any commit boundary.

**Architecture:** Three parallel workstreams converge: (A) architecture foundation cleanup removes coupling and creates abstractions the new UI surfaces depend on; (B) navigation shell restructure installs the new top-level layout without touching wizard logic; (C) the Library backend + UI enables connection reuse across pipelines. Canvas (Phase 5) and PipelineDomain model (Phase 7) are the final convergence gates — both depend on all three streams being complete.

**Tech Stack:** Next.js 16 App Router, Zustand (slice pattern), Drizzle ORM + Postgres (SQLite fallback), React Flow (XY Flow), Zod, TypeScript strict, pnpm, Vitest

---

## Scope Note — This Is a Master Plan

This plan spans **9 independent subsystems**. Each subsystem can be executed as a separate detailed plan and ships working, testable software on its own. This document defines what each subsystem delivers and the dependency graph. Before executing any subsystem sprint, write a detailed task-by-task implementation plan for it using the `superpowers:writing-plans` skill.

---

## Dependency Graph

```
Track A — Architecture Foundation
  A1  Step Registry Consolidation           (no deps)
  A2  Bug Fixes + Duration Parser           (no deps, parallel with A1)
  A3  Schema Canonicalization               (requires A1, A2)
  A4  Source Adapter Interface              (requires A3)
  A5  Transform Unification                 (requires A4)
  A6  PipelineDomain Core Model             (requires A4, A5)
  A7  Design-time / Runtime Store Split     (requires A6)

Track B — Navigation Shell                  (parallel with A1–A2)
  B1  Shell Restructure + Dashboard + Create Modal + Observability Stub

Track C — Library                           (parallel with A1–A3)
  C1  Library Backend (Drizzle + Postgres + API routes)
  C2  Library UI (connection / schema / folder management)
  C3  Wizard to Library Bridge              (requires C2 + A1)

Track D — Canvas                            (requires A4 + C2)
  D1  React Flow Canvas + Node Components
  D2  Library Sidebar + Pipeline Serialization
  D3  AI to Canvas Handoff

Track E — Observability MVP                 (requires B1)
  E1  Per-Pipeline Health + DLQ + Notifications
```

**Sprint schedule:**

| Sprint | Subsystems (parallel) |
|---|---|
| 1 | A1 Step Registry + A2 Bug Fixes + B1 Nav Shell |
| 2 | A3 Schema Canonicalization + C1 Library Backend |
| 3 | A4 Source Adapters + C2 Library UI |
| 4 | C3 Wizard-Library Bridge + E1 Observability MVP |
| 5 | D1 Canvas + D2 Canvas Serialization |
| 6 | D3 AI-Canvas + A5 Transform Unification |
| 7 | A6 PipelineDomain Model + A7 Store Split |

---

## A1 — Step Registry Consolidation

**Delivers:** Adding a new wizard step requires editing exactly one file (`src/config/step-registry.ts`), not six.

**Current state:** Every step must be registered in `StepKeys` enum, `stepsMetadata`, `componentsMap`, `STEP_RENDERER_CONFIG`, `sidebarStepConfig`, and `DEPENDENCY_GRAPH.stepNodeMap`. Any inconsistency causes silent runtime failures.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/config/step-registry.ts` | Single `StepDescriptor[]` export — canonical step metadata |
| Modify | `src/modules/create/utils.ts` | Consume registry for `componentsMap` and `sidebarStepConfig` |
| Modify | `src/modules/pipelines/[id]/step-renderer/stepRendererConfig.ts` | Consume registry for `STEP_RENDERER_CONFIG` |
| Modify | `src/config/constants.ts` | Keep `StepKeys` enum (backward compat); remove `stepsMetadata` once migrated |
| Modify | `src/store/state-machine/dependency-graph.ts` | Consume `dependsOn` from registry instead of hard-coded map |

### StepDescriptor interface

```typescript
// src/config/step-registry.ts
export interface StepDescriptor {
  key: StepKey;
  title: string | ((ctx: { topics: { name: string }[] }) => string);
  component: React.ComponentType<StepProps>;
  guard?: (state: RootStoreState) => boolean;
  dependsOn?: StepKey[];
  sectionKey: SectionKey;
  canEditInPlace?: boolean;
  editTitle?: string;
}

export const STEP_REGISTRY: StepDescriptor[] = [
  {
    key: 'kafka-connection',
    title: 'Connect to Kafka',
    component: KafkaConnectionStep,
    sectionKey: 'source',
    canEditInPlace: true,
    editTitle: 'Kafka Connection',
  },
  // ... all 17 steps defined here
];
```

### Tests

```typescript
// src/config/step-registry.test.ts
import { STEP_REGISTRY } from './step-registry';
import { StepKeys } from './constants';

test('all StepKeys have a descriptor', () => {
  const registeredKeys = STEP_REGISTRY.map(d => d.key);
  Object.values(StepKeys).forEach(key => {
    expect(registeredKeys).toContain(key);
  });
});

test('no duplicate keys', () => {
  const keys = STEP_REGISTRY.map(d => d.key);
  expect(keys.length).toBe(new Set(keys).size);
});

test('all dependsOn references point to registered keys', () => {
  const registeredKeys = new Set(STEP_REGISTRY.map(d => d.key));
  STEP_REGISTRY.forEach(d => {
    d.dependsOn?.forEach(dep => {
      expect(registeredKeys.has(dep)).toBe(true);
    });
  });
});
```

Run: `pnpm vitest run src/config/step-registry.test.ts`

### Acceptance criteria

- [ ] `componentsMap` is derived from `STEP_REGISTRY` — no per-step manual entries
- [ ] `STEP_RENDERER_CONFIG` is derived from `STEP_REGISTRY`
- [ ] `sidebarStepConfig` is derived from `STEP_REGISTRY`
- [ ] All existing wizard steps and edit-mode panels render correctly (manual QA)
- [ ] `grep -r 'stepsMetadata\[' src/` returns zero matches

---

## A2 — Bug Fixes + Duration Parser

**Delivers:** Fixes three independent correctness issues: `enterCreateMode` sourceType reset bug, duplicated duration parsers, cross-slice writes via `get() as any`.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/utils/duration.ts` | Single `parseGoDuration(s)` export, replaces 3 duplicates |
| Create | `src/store/cross-slice-effects.ts` | Subscribe-based cross-slice wiring, called once at startup |
| Modify | `src/store/core.ts:382–394` | `enterCreateMode(sourceType: SourceType = 'kafka')` — pass through |
| Modify | `src/store/topics.store.ts:83–98` | Remove `get() as any` casts; rely on cross-slice-effects instead |
| Modify | `src/store/core.ts:222` | `getComputedOperation()` — remove `get() as any` cast |
| Modify | `src/store/hydration/topics.ts` | Replace local duration parser with `parseGoDuration` import |
| Modify | `src/store/hydration/clickhouse-destination.ts` | Same |
| Modify | `src/store/hydration/join-configuration.ts` | Same |

### duration.ts implementation

```typescript
// src/utils/duration.ts
// Parses Go duration strings (e.g. "1s", "500ms", "1m30s", "2h") to milliseconds.
export function parseGoDuration(s: string): number {
  if (!s || s === '0') return 0;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)(h|m(?!s)|s|ms|us|ns)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s)) !== null) {
    const n = parseFloat(match[1]);
    switch (match[2]) {
      case 'h':  total += n * 3_600_000; break;
      case 'm':  total += n * 60_000; break;
      case 's':  total += n * 1_000; break;
      case 'ms': total += n; break;
      case 'us': total += n / 1_000; break;
      case 'ns': total += n / 1_000_000; break;
    }
  }
  return total;
}
```

### cross-slice-effects.ts wiring

```typescript
// src/store/cross-slice-effects.ts
// Wires cross-slice side effects via subscribe. Call wireCrossSliceEffects() once at startup.
import { useStore } from './index';

export function wireCrossSliceEffects() {
  useStore.subscribe(
    (s) => s.topicsStore.topics,
    (_topics, prev) => {
      if (prev === _topics) return;
      const { joinStore, deduplicationStore } = useStore.getState();
      joinStore.setStreams([]);
      deduplicationStore.invalidateDeduplication();
    },
  );
}
```

Call `wireCrossSliceEffects()` once in `src/app/layout.tsx`.

### Tests

```typescript
// src/utils/duration.test.ts
import { parseGoDuration } from './duration';

test.each([
  ['0',        0],
  ['1s',       1000],
  ['500ms',    500],
  ['1m30s',    90_000],
  ['2h',       7_200_000],
  ['1h30m10s', 5_410_000],
])('parseGoDuration(%s) === %d', (input, expected) => {
  expect(parseGoDuration(input)).toBeCloseTo(expected, 1);
});
```

Run: `pnpm vitest run src/utils/duration.test.ts`

### Acceptance criteria

- [ ] `enterCreateMode('otlp')` sets `sourceType` to `'otlp'` without fallback hacks downstream
- [ ] `grep -r 'get() as any' src/store/` returns zero matches
- [ ] `grep -rn 'hydrateGoToDuration\|durationToMs\|parseDurationToMs' src/store/hydration/` returns zero matches

---

## A3 — Schema Canonicalization

**Delivers:** One `SchemaField` type used everywhere; one type-conversion path; `SchemaService.getEffectiveSchema()` replaces the 609-line hook implementation.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/schema.ts` | `SchemaField`, `InternalFieldType`, `SchemaFieldSource` |
| Create | `src/utils/type-conversion.ts` | `jsonTypeToClickHouseType()`, `clickHouseTypeToJsonType()`, `normalizeFieldType()` |
| Create | `src/utils/schema-service.ts` | `getEffectiveSchema(storeState): SchemaField[]` |
| Modify | `src/modules/clickhouse/utils.ts:618–645` | Delete `inferJsonType`; import from `type-conversion.ts` |
| Modify | `src/modules/clickhouse/utils.ts:912–928` | Delete `getDefaultClickHouseType`; import from `type-conversion.ts` |
| Modify | `src/store/hydration/clickhouse-destination.ts:109–127` | Delete `mapClickHouseTypeToJsonType`; import from `type-conversion.ts` |
| Modify | `src/hooks/useClickhouseMapperEventFields.ts` | Delegate to `SchemaService.getEffectiveSchema(useStore.getState())` |

### Schema types

```typescript
// src/types/schema.ts
export type InternalFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'timestamp';
export type SchemaFieldSource = 'topic' | 'transform' | 'inferred' | 'user';

export interface SchemaField {
  name: string;
  type: InternalFieldType;
  nullable: boolean;
  source?: SchemaFieldSource;
  originalType?: string;
}
```

### Tests

```typescript
// src/utils/type-conversion.test.ts
import { jsonTypeToClickHouseType, clickHouseTypeToJsonType } from './type-conversion';
import type { InternalFieldType } from '../types/schema';

test.each([
  ['string',    'String'],
  ['number',    'Float64'],
  ['boolean',   'UInt8'],
  ['timestamp', 'DateTime64(3)'],
  ['object',    'String'],
])('jsonTypeToClickHouseType(%s) = %s', (json, ch) => {
  expect(jsonTypeToClickHouseType(json as InternalFieldType)).toBe(ch);
});

test('roundtrip: json → CH → json preserves type for scalar types', () => {
  const types: InternalFieldType[] = ['string', 'number', 'boolean', 'timestamp'];
  types.forEach(t => {
    expect(clickHouseTypeToJsonType(jsonTypeToClickHouseType(t))).toBe(t);
  });
});
```

```typescript
// src/utils/schema-service.test.ts
import { getEffectiveSchema } from './schema-service';

test('source-only: returns topic schema fields unchanged', () => {
  const state = buildMockState({ topics: [{ fields: [{ name: 'id', type: 'string' }] }] });
  expect(getEffectiveSchema(state)).toEqual([{ name: 'id', type: 'string', nullable: false }]);
});

test('source + transformation: adds computed fields', () => { /* ... */ });
test('otlp source: returns static OTLP schema fields', () => { /* ... */ });
test('join: merges fields from both topics', () => { /* ... */ });
```

Run: `pnpm vitest run src/utils/type-conversion.test.ts src/utils/schema-service.test.ts`

### Acceptance criteria

- [ ] `grep -rn 'inferJsonType\|getDefaultClickHouseType\|mapClickHouseTypeToJsonType' src/` returns zero matches outside `type-conversion.ts`
- [ ] `useClickhouseMapperEventFields` hook body is ≤ 30 lines
- [ ] ClickHouse mapper step renders identically before and after (manual QA)

---

## A4 — Source Adapter Interface

**Delivers:** ~60 `isOtlpSource()` call sites eliminated; adding a third source type requires one new adapter file + factory registration.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/adapters.ts` | `SourceAdapter<TConfig, TConnectionParams>` interface |
| Create | `src/adapters/source/index.ts` | `getSourceAdapter(type: SourceType)` factory |
| Create | `src/adapters/source/kafka/adapter.ts` | `KafkaSourceAdapter implements SourceAdapter` |
| Create | `src/adapters/source/kafka/configBuilder.ts` | Extracted from `buildInternalPipelineConfig` lines 91–370 |
| Create | `src/adapters/source/kafka/hydrator.ts` | Extracted from `hydration/kafka-connection.ts` + `hydration/topics.ts` |
| Create | `src/adapters/source/otlp/adapter.ts` | `OtlpSourceAdapter implements SourceAdapter` |
| Create | `src/adapters/source/otlp/hydrator.ts` | Extracted from `hydration/otlp.ts` |
| Modify | `src/modules/clickhouse/utils.ts` | `buildInternalPipelineConfig` delegates source section to `adapter.toWireFormat(config)` |
| Modify | `src/store/hydration/index.ts` | `hydrateSection` dispatches to `adapter.fromWireFormat(wire)` |
| Modify | `src/store/state-machine/dependency-graph.ts` | Register source nodes via adapter instead of Kafka hard-coding |

### SourceAdapter interface

```typescript
// src/types/adapters.ts
import { SchemaField } from './schema';

export interface ConnectionResult { success: boolean; error?: string }
export interface Topic { id: string; name: string; partitions?: number }

export interface SourceAdapter<TConfig = unknown, TConnectionParams = unknown> {
  readonly type: SourceType;
  validateConnection(params: TConnectionParams): Promise<ConnectionResult>;
  getTopics?(params: TConnectionParams): Promise<Topic[]>;
  getSchema(topicId: string, params: TConnectionParams): Promise<SchemaField[]>;
  toWireFormat(config: TConfig): WireSourceConfig;
  fromWireFormat(wire: WireSourceConfig): TConfig;
}
```

### Tests

Roundtrip tests must cover all 7 Kafka auth mechanisms: `none`, `sasl-plain`, `sasl-scram-256`, `sasl-scram-512`, `sasl-gssapi`, `mtls`, `sasl-aws-msk-iam`.

```typescript
// src/adapters/source/kafka/adapter.test.ts
import { KafkaSourceAdapter } from './adapter';

const adapter = new KafkaSourceAdapter();

describe('toWireFormat / fromWireFormat roundtrip', () => {
  test.each(AUTH_MECHANISM_FIXTURES)('auth: %s', (_name, config) => {
    const wire = adapter.toWireFormat(config);
    const restored = adapter.fromWireFormat(wire);
    expect(restored).toEqual(config);
  });
});
```

Run: `pnpm vitest run src/adapters/source/`

### Acceptance criteria

- [ ] `grep -rn 'isOtlpSource' src/` returns zero matches outside `src/adapters/`
- [ ] `buildInternalPipelineConfig` source section is ≤ 20 lines
- [ ] Hydration → generate roundtrip passes for both Kafka and OTLP pipeline fixtures

---

## A5 — Transform Unification

**Delivers:** Four transform stores become registered `TransformPlugin` implementations. Schema flow (what each transform consumes and produces) is explicit and machine-readable.

**Prerequisite:** A4.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/adapters/transform/index.ts` | `TransformPlugin` interface + `getTransformPlugin(type)` registry |
| Create | `src/adapters/transform/deduplication/plugin.ts` | Wraps `deduplicationStore` as `TransformPlugin` |
| Create | `src/adapters/transform/join/plugin.ts` | Wraps `joinStore` |
| Create | `src/adapters/transform/filter/plugin.ts` | Wraps `filterStore` |
| Create | `src/adapters/transform/stateless/plugin.ts` | Wraps `transformationStore` |
| Modify | `src/modules/clickhouse/utils.ts` | Transforms section iterates plugin registry |
| Modify | `src/utils/schema-service.ts` | `getEffectiveSchema` calls `plugin.getOutputSchema()` per active transform in order |

### TransformPlugin interface

```typescript
// src/adapters/transform/index.ts
export interface TransformPlugin<TConfig = unknown> {
  readonly type: TransformType;
  readonly enabled: boolean;
  getInputSchema(upstream: SchemaField[]): SchemaField[];
  getOutputSchema(input: SchemaField[], config: TConfig): SchemaField[];
  validate(config: TConfig): { valid: boolean; errors: string[] };
  toWireFormat(config: TConfig): WireTransformConfig;
  fromWireFormat(wire: WireTransformConfig): TConfig;
}
```

---

## A6 — PipelineDomain Core Model

**Delivers:** `PipelineDomain` is a structured first-class object. Wizard, Canvas, and AI all populate the same domain object. Clean design-time / runtime state separation.

**Prerequisite:** A4 + A5.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/pipeline-domain.ts` | `PipelineDomain`, `SourceConfig`, `TransformConfig`, `SinkConfig`, `ResourceConfig` |
| Create | `src/store/domain.store.ts` | `PipelineDomainStore` with `getSchema()`, `validate()`, dirty tracking |
| Create | `src/store/deployment.store.ts` | `status`, `pipeline_id`, `version`, `created_at`, `updated_at` |
| Modify | `src/store/core.ts` | Thin orchestrator; design-time UI state only |
| Modify | `src/store/hydration/index.ts` | `hydrateSection` populates `PipelineDomain` via adapter dispatch |
| Modify | `src/modules/pipeline-adapters/PipelineAdapter.ts` | `generate()` calls `domainStore.toPipelineDomain()` → adapter chain |

### PipelineDomain type

```typescript
// src/types/pipeline-domain.ts
export interface PipelineDomain {
  id?: string;
  name: string;
  sources: SourceConfig[];       // replaces topicCount — indexed collection
  transforms: TransformConfig[]; // ordered pipeline
  sink: SinkConfig;
  resources: ResourceConfig;
}
```

### Acceptance criteria

- [ ] `coreStore.topicCount` is derived from `domainStore.sources.length` — not a separate primitive
- [ ] `coreStore.apiConfig` stale mirror removed; `ReviewConfiguration` calls `domainStore.toWireFormat()` directly
- [ ] AI `materializeIntentToStore` populates `PipelineDomain` via domain store
- [ ] Wizard, edit mode, and AI flow produce identical wire format for the same config

---

## A7 — Design-time / Runtime Store Split

**Delivers:** `coreStore` holds design-time configuration only. Pipeline status and deployment metadata are in `deploymentStore`.

**Prerequisite:** A6.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/store/deployment.store.ts` | `pipeline_status`, `pipeline_id`, `version`, `created_at`, `updated_at` |
| Modify | `src/store/core.ts` | Remove all deployment fields |
| Modify | `src/store/hydration/index.ts` | Hydrate deployment fields into `deploymentStore` |
| Create | `src/store/runtime.store.ts` | Empty stub for future observability data (throughput, lag) |

---

## B1 — Navigation Shell Restructure

**Delivers:** New 5-item top-level navigation; Dashboard page with real pipeline data; Create modal with lane selector; Library and Observability route stubs.

**Can run in parallel with A1 + A2.**

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/app/(shell)/layout.tsx` | Root layout with new nav shell |
| Create | `src/components/shared/AppSidebar.tsx` | Sidebar: Dashboard, Pipelines, Library, Observability, Create button |
| Create | `src/app/(shell)/dashboard/page.tsx` | Server component: pipeline list + aggregate health cards |
| Create | `src/app/(shell)/library/page.tsx` | Library empty state with CTA |
| Create | `src/app/(shell)/observability/page.tsx` | Observability stub |
| Create | `src/components/common/CreatePipelineModal.tsx` | Lane selector modal |
| Modify | `src/app/(shell)/pipelines/` | Move existing pipeline routes under new shell layout |

### Create modal

```tsx
// Lanes: Wizard always shown, Canvas shown as disabled, AI hidden if !aiEnabled
function CreatePipelineModal({ open, onClose, aiEnabled }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0">
        <DialogTitle className="modal-title">Create a new pipeline</DialogTitle>
        <div className="grid grid-cols-1 gap-3 mt-4">
          <LaneTile title="Wizard" description="Step-by-step guided setup" onClick={handleStartWizard} />
          <LaneTile title="Canvas" description="Compose from library" disabled badge="Coming soon" />
          {aiEnabled && <LaneTile title="AI Assistant" description="Describe your intent" onClick={handleStartAI} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

`aiEnabled` is passed from a Server Component — never read `process.env` client-side.

### Dashboard (Server Component)

```tsx
// src/app/(shell)/dashboard/page.tsx
const pipelines = await getPipelines();
const stats = {
  total: pipelines.length,
  running: pipelines.filter(p => p.status === 'running').length,
  error:   pipelines.filter(p => p.status === 'error').length,
};
return <DashboardClient pipelines={pipelines} stats={stats} />;
```

### Acceptance criteria

- [ ] Wizard fully functional via Create → Wizard
- [ ] AI lane tile hidden when no AI API key is configured server-side
- [ ] Library + Observability show meaningful empty states
- [ ] Existing `/pipelines/[id]` routes still work

---

## C1 — Library Backend

**Delivers:** Drizzle ORM + Postgres (SQLite fallback); database migrations; full CRUD API for Kafka connections, ClickHouse connections, schemas, and folders.

**Can run in parallel with A1–A3.**

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/db/index.ts` | Drizzle client factory — Postgres if `DATABASE_URL` set, else SQLite |
| Create | `src/lib/db/schema.ts` | Table definitions in `ui_library` schema |
| Create | `src/lib/db/migrations/0001_initial.sql` | DDL for all tables |
| Create | `src/lib/db/migrate.ts` | Migration runner (called at startup) |
| Create | `src/app/ui-api/library/connections/kafka/route.ts` | GET list, POST create |
| Create | `src/app/ui-api/library/connections/kafka/[id]/route.ts` | GET, PUT, DELETE |
| Create | `src/app/ui-api/library/connections/clickhouse/route.ts` | GET list, POST create |
| Create | `src/app/ui-api/library/connections/clickhouse/[id]/route.ts` | GET, PUT, DELETE |
| Create | `src/app/ui-api/library/schemas/route.ts` | GET, POST |
| Create | `src/app/ui-api/library/schemas/[id]/route.ts` | GET, PUT, DELETE |
| Create | `src/app/ui-api/library/folders/route.ts` | GET, POST |

### Schema

```typescript
// src/lib/db/schema.ts
import { pgSchema, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const uiLibrary = pgSchema('ui_library');

export const folders = uiLibrary.table('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kafkaConnections = uiLibrary.table('kafka_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  config: jsonb('config').$type<KafkaConnectionConfig>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// clickhouseConnections, schemas: same pattern
```

Note: Credential encryption at rest (AES-256-GCM, key from `LIBRARY_ENCRYPTION_KEY`) is deferred to a follow-up task before production release.

### Tests

```typescript
// src/lib/db/schema.test.ts — integration test, requires test DB
test('create and retrieve kafka connection', async () => {
  const [conn] = await db.insert(kafkaConnections).values({
    name: 'test-kafka',
    config: { bootstrapServers: ['localhost:9092'], authMethod: 'none' },
  }).returning();
  expect(conn.name).toBe('test-kafka');
  const found = await db.select().from(kafkaConnections).where(eq(kafkaConnections.id, conn.id));
  expect(found[0].id).toBe(conn.id);
});
```

Run: `DATABASE_URL=postgres://localhost:5432/glassflow_test pnpm vitest run src/lib/db/`

---

## C2 — Library UI

**Delivers:** Users can create, view, edit, and delete saved Kafka/ClickHouse connections and schemas from the Library section.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/modules/library/components/ConnectionsList.tsx` | List view with search, folder filter, tags |
| Create | `src/modules/library/components/KafkaConnectionFormModal.tsx` | Create/edit — reuses `KafkaConnectionStep` form fields |
| Create | `src/modules/library/components/ClickHouseConnectionFormModal.tsx` | Create/edit — reuses CH connection form fields |
| Create | `src/modules/library/components/SchemaList.tsx` | Schema list with field preview |
| Create | `src/modules/library/components/FolderTree.tsx` | Folder sidebar |
| Create | `src/hooks/useLibraryConnections.ts` | SWR hooks for kafka/clickhouse/schema lists |
| Modify | `src/app/(shell)/library/page.tsx` | Wire up module components |

Design rules (non-negotiable per CLAUDE.md):
- No hardcoded colors — CSS tokens only
- `<Card variant="dark">` for connection cards, `<Badge variant="secondary">` for tags
- Modal shell from CLAUDE.md section 5

---

## C3 — Wizard to Library Bridge

**Delivers:** After a successful connection test in the wizard, user is offered a "Save to Library" prompt. Saved connections surface as shortcuts at the top of the connection step.

**Prerequisite:** C2 + A1.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/common/SaveToLibraryPrompt.tsx` | Inline "name + save" prompt shown post-test |
| Create | `src/components/common/UseSavedConnectionChips.tsx` | "Use saved: kafka-prod" chip list |
| Modify | `src/modules/kafka/components/KafkaConnectionStep.tsx` | Inject `SaveToLibraryPrompt` after test success |
| Modify | `src/modules/clickhouse/components/ClickHouseConnectionStep.tsx` | Same |

Behavior: prompt is non-blocking (dismiss with ✕). Clicking a saved connection chip fills the form with that connection's config.

---

## D1 — React Flow Canvas + Node Components

**Delivers:** Visual pipeline builder. Users see their pipeline as a node graph and can configure each stage by clicking its node.

**Prerequisite:** A4 + C2. Install: `pnpm add @xyflow/react`

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/app/(shell)/canvas/page.tsx` | Canvas route |
| Create | `src/modules/canvas/CanvasView.tsx` | React Flow wrapper + layout |
| Create | `src/modules/canvas/nodes/KafkaSourceNode.tsx` | Source node with connection badge |
| Create | `src/modules/canvas/nodes/OtlpSourceNode.tsx` | OTLP source node |
| Create | `src/modules/canvas/nodes/DedupNode.tsx` | Always rendered; greyed when disabled |
| Create | `src/modules/canvas/nodes/FilterNode.tsx` | Same pattern |
| Create | `src/modules/canvas/nodes/TransformNode.tsx` | Same pattern |
| Create | `src/modules/canvas/nodes/JoinNode.tsx` | Two inputs, one output |
| Create | `src/modules/canvas/nodes/ClickHouseSinkNode.tsx` | Sink node |
| Create | `src/modules/canvas/NodeConfigPanel.tsx` | Side panel — embeds existing step component for clicked node |
| Create | `src/store/canvas.store.ts` | Canvas state: nodes, edges, active node |

Optional nodes (Dedup, Filter, Transform) are **always rendered** but appear with `opacity-40 pointer-events-none` when disabled. The user clicks to toggle active.

### Canvas to pipeline config

```typescript
// src/modules/canvas/serializer.ts
export function canvasToPipelineConfig(canvasState: CanvasState): InternalPipelineConfig {
  const sourceAdapter = getSourceAdapter(canvasState.sourceType);
  return {
    source: sourceAdapter.toWireFormat(canvasState.sourceConfig),
    transforms: canvasState.activeTransforms.map(t =>
      getTransformPlugin(t.type).toWireFormat(t.config)
    ),
    sink: canvasState.sinkConfig,
    resources: canvasState.resources,
  };
}
```

---

## D2 — Library Sidebar + Canvas Deploy

**Delivers:** Library sidebar on canvas for dragging saved connections onto source nodes; "Deploy" button uses existing pipeline creation API route.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/modules/canvas/LibrarySidebar.tsx` | Searchable list of saved connections; drag to drop onto nodes |
| Modify | `src/modules/canvas/CanvasView.tsx` | Wire sidebar drop event to node hydration |
| Modify | `src/app/(shell)/canvas/page.tsx` | "Deploy" button — calls `/ui-api/pipeline` (existing route) |

---

## D3 — AI to Canvas Handoff

**Delivers:** AI chat completion pre-populates canvas nodes instead of routing directly to wizard.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/modules/ai/materializeIntentToStore.ts` | Accept `targetLane: 'wizard' \| 'canvas'`; populate `canvas.store` when canvas |
| Modify | `src/app/pipelines/create/ai/page.tsx` | Add "Open in Canvas" button after intent is complete; "Continue in Wizard" remains |

---

## E1 — Observability MVP

**Delivers:** Per-pipeline health status, DLQ message count and consume action, notification channel configuration.

**Prerequisite:** B1.

### Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/app/(shell)/observability/[id]/page.tsx` | Per-pipeline observability view |
| Create | `src/modules/observability/PipelineHealthCard.tsx` | Status badge, uptime, error rate |
| Create | `src/modules/observability/DLQViewer.tsx` | DLQ count + consume action |
| Create | `src/modules/observability/NotificationChannelConfig.tsx` | Notification channel form |
| Create | `src/app/ui-api/observability/[id]/health/route.ts` | Proxy to Go `/health` API |
| Create | `src/app/ui-api/observability/[id]/dlq/route.ts` | Proxy to Go DLQ endpoints |

---

## Full Testing Strategy

| Layer | Tool | What to test |
|---|---|---|
| Duration parser | Vitest unit | All Go duration formats + edge cases |
| Type conversion | Vitest unit | JSON to CH roundtrips for all field types |
| Source adapter | Vitest unit | `toWireFormat`/`fromWireFormat` roundtrip for all 7 Kafka auth mechanisms + OTLP |
| Schema service | Vitest unit | 5 schema pipeline scenarios (source-only, dedup, transform, OTLP, join) |
| Step registry | Vitest unit | All keys registered, no duplicates, all `dependsOn` refs valid |
| Library API routes | Vitest integration | CRUD, auth checks, FK constraints |
| Hydration roundtrip | Vitest integration | Load V3 fixture → hydrate → generate → compare original |
| Canvas serializer | Vitest unit | Single-topic, two-topic, OTLP configs → wire format |

Do NOT:
- Write snapshot tests for wizard step arrays — they break on every journey change
- Test which UI variant renders — too brittle, low signal
- Mock stores in component tests — test with real state, mock only network calls

---

## Risk Register

| Risk | Sprint | Mitigation |
|---|---|---|
| Schema canonicalization breaks mapper | 2 | Write `type-conversion.test.ts` before deleting old functions |
| Step registry breaks edit-mode panels | 1 | Manual QA: open each pipeline section in edit mode after A1 |
| `hydrateKafkaTopics` mixes pure mapping + API calls | 3 | Keep network side effects in hydrator; only move pure mapping to adapter |
| Drizzle + SQLite fallback differences | 2 | Test against both dialects in CI via `DATABASE_URL` env switch |
| Canvas React Flow performance | 5 | Medium-grain nodes (one per stage) keeps graph to ≤ 10 nodes |
| `enterCreateMode` fix ripples | 1 | `grep -rn 'enterCreateMode\b' src/` — audit all callers before patching |
| PipelineDomain migration breaks AI materialization | 7 | Keep `materializeIntentToStore` working against both old slices and domain store through sprint 7 |

---

## How to Execute Each Subsystem

Before starting any sprint, generate a detailed implementation plan for each subsystem in scope:

```
"Write a detailed task-by-task implementation plan for subsystem A1
(Step Registry Consolidation) as described in
docs/superpowers/plans/2026-04-24-ui-architecture-revamp.md.
Use the superpowers:writing-plans skill."
```

Each detailed plan will have line-level file edits, complete code for each step, test commands with expected output, and commit points.

---

*Master plan authored: 2026-04-24.*
*Sources: ARCHITECTURE_ANALYSIS_2026.md, UI_REVAMP_2026.md, UI_REVAMP_DRAFT_LOG_2026.md (branch: ui-architecture-2.0).*
