# Ticket 11 — AI Assistant Drawer: Remaining Gaps

**Date:** 2026-05-08
**Branch:** `ui-ux-revamp-2.0`
**Scope:** Two surgical gaps that complete an otherwise fully-built feature.

---

## Context

The AI assistant drawer is almost entirely implemented:

| Component | Status |
|-----------|--------|
| `AiDrawer`, `AiChatPanel`, all tool/message cards | ✅ done |
| `ai-ui.store.ts` (open/scope/transcripts/streaming) | ✅ done |
| `AiToggleButton` with ⌘K keybinding | ✅ done |
| `AiDrawerMount` in root layout | ✅ done |
| `/ui-api/ai/chat` streaming route + tool loop | ✅ done |
| `/ui-api/ai/chats/[pipelineId]` GET/PUT persistence | ✅ done |
| Tool routes: `library-search`, `pipeline-draft`, `validate` | ✅ done |
| `aiChats` Drizzle table | ✅ done |

Two gaps prevent the feature from being shippable:

1. **Canvas draft loading** — the `pipeline_draft` tool returns `openInCanvasUrl: /canvas?draft=<id>`, but `CanvasPage` ignores the `draft` param and renders a blank canvas.
2. **Feature flag** — `AiDrawerMount` and the `AiToggleButton` in `AppTopbar` render unconditionally regardless of whether `ANTHROPIC_API_KEY` is set.

---

## Gap 1: Canvas Draft Loading

### Approach

Best-effort field mapping (Approach A). Add a `pipelineConfigToCanvas` reverse-serializer symmetric to the existing `canvasToPipelineConfig`. Library ref IDs are **not** restored (the references are persisted in `pipelineReferences` rows; the user sees `DriftBanner` prompting re-attachment on the canvas). This is acceptable for the AI draft use case — the user reviews and adjusts in canvas before deploying.

### Changes

**`src/modules/canvas/serializer.ts`** — add:

```ts
export interface CanvasHydration {
  nodes: Node[]
  edges: Edge[]
  nodeConfigs: Record<string, Record<string, unknown>>
  sourceType: CanvasSourceType
}

export function pipelineConfigToCanvas(config: InternalPipelineConfig): CanvasHydration
```

Mapping rules (all fields are best-effort; missing fields fall back to safe defaults):

| `InternalPipelineConfig` field | Canvas target |
|---|---|
| `source.type` | `sourceType` + node type (`kafkaSource` / `otlpSource`) |
| `source.connection_params.brokers[]` | `nodeConfigs.source.bootstrapServers` (joined with `,`) — Kafka only |
| `source.id` | `nodeConfigs.source.endpoint` — OTLP only |
| `source.topics[0].name` | `nodeConfigs.source.topicName` — Kafka only |
| `source.topics[0].deduplication.enabled` | dedup node `disabled` flag |
| `source.topics[0].deduplication.id_field` | `nodeConfigs.dedup.idField` |
| `source.topics[0].deduplication.time_window` | `nodeConfigs.dedup.timeWindow` |
| `filter.enabled` | filter node `disabled` flag |
| `filter.expression` | `nodeConfigs.filter.expression` |
| `stateless_transformation.enabled` | transform node `disabled` flag |
| `stateless_transformation.config.transform[0].expression` | `nodeConfigs.transform.expression` |
| `sink.host/httpPort/database/table/secure/…` | `nodeConfigs.sink.*` |

Fixed node IDs and default edge set (`source→dedup→filter→transform→sink`) match `buildDefaultPipeline` exactly, so the canvas renders correctly with no additional wiring.

**`src/store/canvas.store.ts`** — add one action:

```ts
initFromConfig: (hydration: CanvasHydration) => void
```

Sets `nodes`, `edges`, `nodeConfigs`, `sourceType` atomically. Marks `isDirty: false`. Same shape as the existing `initDefaultPipeline` action.

**`src/app/(shell)/canvas/page.tsx`** — convert to async server component reading `searchParams`:

```ts
type PageProps = { searchParams: Promise<{ draft?: string }> }

export default async function CanvasPage({ searchParams }: PageProps) {
  const { draft } = await searchParams
  let initialConfig: InternalPipelineConfig | null = null
  if (draft) {
    // Fetch latest revision for draft pipelineId from Drizzle
    const [rev] = await db.select().from(pipelineRevisions)
      .where(eq(pipelineRevisions.pipelineId, draft))
      .orderBy(desc(pipelineRevisions.revision))
      .limit(1)
    initialConfig = (rev?.config as InternalPipelineConfig) ?? null
  }
  return <CanvasView pipelineId={null} currentRevision={null} initialConfig={initialConfig} />
}
```

**`src/modules/canvas/CanvasView.tsx`** — add `initialConfig?: InternalPipelineConfig | null` prop. In `CanvasInner`:

```ts
React.useEffect(() => {
  if (initialConfig) {
    initFromConfig(pipelineConfigToCanvas(initialConfig))
  } else if (nodes.length === 0) {
    initDefaultPipeline('kafka')
  }
}, []) // runs once on mount
```

### Tests

`serializer.test.ts` — extend with `pipelineConfigToCanvas` unit tests:
- Kafka source with dedup active
- Kafka source with all optional nodes disabled
- OTLP source
- Round-trip: `canvasToPipelineConfig` → `pipelineConfigToCanvas` → nodeConfigs match

`canvas.store.ts` — `initFromConfig` action tested in existing store test pattern.

---

## Gap 2: Feature Flag

### Changes

**`src/app/layout.tsx`** (root server component) — read env var and pass to `AiDrawerMount`:

```tsx
const aiEnabled = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
// …
<AiDrawerMount aiEnabled={aiEnabled} />
```

**`src/components/shared/AiDrawerMount.tsx`** — accept prop, short-circuit:

```tsx
export function AiDrawerMount({ aiEnabled }: { aiEnabled?: boolean }) {
  if (!aiEnabled) return null
  return <AiDrawer />
}
```

**`src/components/shared/AppTopbar.tsx`** — accept `aiEnabled?: boolean` prop, wrap toggle:

```tsx
{aiEnabled && <AiToggleButton compact />}
```

**`src/components/shared/ShellLayoutClient.tsx`** — pass `aiEnabled` (already received as prop) through to `AppTopbar`.

`AppSidebar` also imports `AiToggleButton` but is not rendered in the active shell layout — no change needed.

---

## File Map

| File | Change |
|---|---|
| `src/modules/canvas/serializer.ts` | Add `CanvasHydration` type + `pipelineConfigToCanvas()` |
| `src/store/canvas.store.ts` | Add `initFromConfig` action to state/actions/slice |
| `src/app/(shell)/canvas/page.tsx` | Read `searchParams.draft`, fetch from Drizzle, pass `initialConfig` |
| `src/modules/canvas/CanvasView.tsx` | Accept + apply `initialConfig` on mount |
| `src/app/layout.tsx` | Pass `aiEnabled` to `AiDrawerMount` |
| `src/components/shared/AiDrawerMount.tsx` | Accept `aiEnabled`, return null if false |
| `src/components/shared/AppTopbar.tsx` | Accept `aiEnabled`, gate `AiToggleButton` |
| `src/components/shared/ShellLayoutClient.tsx` | Pass `aiEnabled` to `AppTopbar` |
| `src/modules/canvas/__tests__/serializer.test.ts` | Extend with `pipelineConfigToCanvas` tests |

No new files. No new routes. No schema changes.

---

## Invariants Preserved

- The `pipeline_draft` tool never deploys — it only creates a `pipelineRevisions` row with `env: 'draft'`. The Canvas DeployBar creates the real deploy.
- Canvas state is client-only after hydration — the server component fetches the config, the client applies it.
- `isDirty: false` on `initFromConfig` — the user starts from a clean draft, not a "modified" state.
- Feature flag is server-side only — `ANTHROPIC_API_KEY` is never sent to the client.
