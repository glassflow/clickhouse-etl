# Canvas — Architecture Reference

The Canvas is a visual pipeline builder backed by React Flow. It is an alternative entry point to the pipeline wizard: instead of walking through a sequential step-by-step flow, the engineer sees the pipeline as a directed graph and can configure individual nodes by clicking them.

Route: `src/app/(shell)/canvas/page.tsx` → `/canvas`

---

## Canvas store

`src/store/canvas.store.ts` — `createCanvasSlice: StateCreator<CanvasSlice>`

Access via `const { canvasStore } = useStore()`.

### `CanvasState`

```ts
interface CanvasState {
  nodes: Node[]                              // React Flow node list
  edges: Edge[]                              // React Flow edge list
  sourceType: CanvasSourceType               // 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'
  activeNodeId: string | null               // node currently open in the side panel
  nodeConfigs: Record<string, Record<string, unknown>>  // keyed by node.id
}
```

`nodeConfigs` is the primary config store. Each node's config is a free-form record of field values; the serializer (`canvasToPipelineConfig`) reads and maps them to `InternalPipelineConfig` shape.

### `CanvasActions`

| Action | Effect |
|--------|--------|
| `setNodes(nodes)` | Replace full node list |
| `setEdges(edges)` | Replace full edge list |
| `applyNodeChanges(changes)` | Pass React Flow `NodeChange[]` through `applyNodeChanges()` |
| `applyEdgeChanges(changes)` | Pass React Flow `EdgeChange[]` through `applyEdgeChanges()` |
| `setActiveNode(id \| null)` | Open/close the node config panel |
| `setNodeConfig(nodeId, config)` | Merge a config record for a specific node (shallow replace, not merge) |
| `setSourceType(type)` | Update `sourceType` without rebuilding the graph |
| `initDefaultPipeline(sourceType)` | Reset nodes, edges, activeNodeId, nodeConfigs; build the default linear graph |

---

## Node model

All nodes are registered in `CanvasView.nodeTypes` and live in `src/modules/canvas/nodes/`.

### Node types

| `type` key | Component file | Handle topology | Extra data props |
|------------|----------------|-----------------|-----------------|
| `kafkaSource` | `KafkaSourceNode.tsx` | source-right | `bootstrapServers`, `topicName` |
| `otlpSource` | `OtlpSourceNode.tsx` | source-right | `endpoint`, `protocol: 'grpc' \| 'http'` |
| `dedup` | `DedupNode.tsx` | target-left, source-right | `idField`, `timeWindow` |
| `filter` | `FilterNode.tsx` | target-left, source-right | `expression` |
| `transform` | `TransformNode.tsx` | target-left, source-right | `expression` |
| `join` | `JoinNode.tsx` | target-left×2 (`left-top`, `left-bottom`), source-right | `joinKey`, `timeWindow` |
| `clickhouseSink` | `ClickHouseSinkNode.tsx` | target-left | `host`, `table` |

`JoinNode` is the only node with two target handles — it models merging two upstream streams.

### Common node data shape

All nodes share:

```ts
{
  label: string       // display name
  disabled?: boolean  // when true: opacity-40, pointer-events-none, serializer skips
}
```

Visual state is driven by `data.disabled` and the React Flow `selected` prop:
- `disabled` → `Card` at 40% opacity, not interactive
- `selected` → `card-dark-selected` modifier class applied

---

## Default pipeline graph

`initDefaultPipeline(sourceType)` builds a fixed linear layout at y = 200, with 250 px horizontal spacing between nodes:

```
source (x:0) → dedup (x:250) → filter (x:500) → transform (x:750) → sink (x:1000)
```

- Source node type is `kafkaSource` when `sourceType === 'kafka'`, otherwise `otlpSource`.
- `dedup`, `filter`, and `transform` are initialised with `disabled: true`.
- Source and sink start with no `disabled` flag (always present in the pipeline).
- `nodeConfigs` is reset to `{}`.

If `CanvasView` mounts and finds `nodes.length === 0`, it calls `initDefaultPipeline('kafka')` automatically (the `useEffect` in `CanvasView.tsx`).

---

## Serializer

`src/modules/canvas/serializer.ts` — `canvasToPipelineConfig(canvas: CanvasState): InternalPipelineConfig`

Reads `canvas.nodes` and `canvas.nodeConfigs`, then builds the `InternalPipelineConfig` shape used by `/ui-api/pipeline POST`.

Key mapping rules:

| Canvas key | Config field | Skip condition |
|-----------|-------------|----------------|
| `nodeConfigs['source']` | `source.connection_params.brokers`, `source.topics[0]` | Never skipped |
| `nodeConfigs['dedup']` | `topics[0].deduplication.id_field`, `.time_window` | Included but `enabled: false` when dedup node is disabled |
| `nodeConfigs['filter']` | `filter.expression` | Omitted (`undefined`) when filter node is disabled |
| `nodeConfigs['transform']` | `stateless_transformation.config.transform[0].expression` | Omitted when transform node is disabled |
| `nodeConfigs['sink']` | `sink.*` | Never skipped |

`brokers` is parsed from `sourceConfig.bootstrapServers` as a comma-separated string. The `join` field is always emitted as `{ enabled: false }` (join is not configurable from the canvas in the current implementation). `pipeline_id` and `name` are empty strings — the deploy endpoint generates them.

OTLP source path: when `sourceNode.type === 'otlpSource'`, the `source` shape uses `{ type: sourceType, id: endpoint }` instead of the Kafka topology.

---

## Library sidebar

`src/modules/canvas/LibrarySidebar.tsx`

Rendered on the left of `CanvasView`. On mount, fetches both `/ui-api/library/connections/kafka` and `/ui-api/library/connections/clickhouse` in parallel. Failures are silently swallowed — library is optional.

Clicking a Kafka connection calls `setNodeConfig(activeNodeId ?? 'source', ...)`, normalising `brokers[]` to a comma-joined `bootstrapServers` string. Clicking a ClickHouse connection calls `setNodeConfig(activeNodeId ?? 'sink', ...conn.config)`.

The sidebar does not trigger re-renders on the ReactFlow canvas — `nodeConfigs` state change is picked up by the serializer at deploy time.

---

## Node config panel

`src/modules/canvas/NodeConfigPanel.tsx`

Slides in on the right when `activeNodeId` is set. Reads `canvasStore.nodeConfigs[nodeId]` and renders each non-empty key-value pair. Contains an "Edit in Wizard" link to `/pipelines/create` for deep configuration.

---

## Deploy

`src/modules/canvas/CanvasDeployButton.tsx`

1. Calls `canvasToPipelineConfig(canvasStore)` to produce `InternalPipelineConfig`.
2. `POST /ui-api/pipeline` with JSON body.
3. Shows inline success/error text next to the button.
4. Uses `loading` and `loadingText` props on `<Button variant="primary">` for spinner state.

The button is rendered in the page header alongside the title in `src/app/(shell)/canvas/page.tsx`.

---

## AI handoff

When the AI assistant materialises an intent with `targetLane = 'canvas'` (`src/modules/ai/materializeIntentToStore.ts`):

1. `store.canvasStore.initDefaultPipeline(sourceType)` — resets the graph.
2. For Kafka source: `setNodeConfig('source', { bootstrapServers, topicName, ... })`.
3. For OTLP source: `setNodeConfig('source', { endpoint })`.
4. `setNodeConfig('sink', { host, database, table, ... })` for the ClickHouse sink.
5. `store.domainStore.setDomain(domain)` — also updates the wizard domain slice for cross-lane consistency.

Call: `materializeIntentToStore(intent, undefined, 'canvas')`.

---

## Extending — adding a new node type

1. **Create the component** in `src/modules/canvas/nodes/YourNode.tsx`. Follow the existing pattern:
   - Define a typed `YourNodeData extends Record<string, unknown>` interface.
   - Use `<Card variant="dark">` with `disabled`/`selected` class modifiers.
   - Add `<Handle type="target" position={Position.Left} />` and/or `<Handle type="source" position={Position.Right} />` as appropriate.

2. **Register in `CanvasView.nodeTypes`** (`src/modules/canvas/CanvasView.tsx`):
   ```ts
   const nodeTypes = useMemo(() => ({
     ...existingTypes,
     yourNode: YourNode,
   }), [])
   ```

3. **Add to `buildDefaultPipeline`** (`src/store/canvas.store.ts`) if the node should appear in the default linear graph. Set `disabled: true` if it is opt-in.

4. **Update the serializer** (`src/modules/canvas/serializer.ts`) to read `nodeConfigs['yourNodeId']` and map it to the appropriate `InternalPipelineConfig` field. Follow the `isXxxActive` pattern for optional nodes.

5. **Add to `NODE_LABELS`** in `NodeConfigPanel.tsx` so the side panel shows a friendly name.

6. **Update AI materialization** (`src/modules/ai/materializeIntentToStore.ts`) if the AI should be able to configure the node.
