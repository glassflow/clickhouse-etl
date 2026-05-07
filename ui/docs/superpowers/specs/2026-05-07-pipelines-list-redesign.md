# Pipelines List Redesign Spec

**Date:** 2026-05-07
**Branch:** ui-ux-revamp-2.0
**Design reference:** T-21 artboards (pipelines-list-artboards1.jsx, artboards2.jsx, pipelines-list.css)

---

## Overview

Refresh the pipelines list page (Option C — full design) while preserving all existing functionality: sorting, filter/URL sync, polling/SSE status, context menu actions, modals, and mobile layout. The redesign adds saved views, multi-select with bulk actions, inline search, density toggle, visual cell improvements, and a redesigned empty state.

---

## Scope

### What changes
- New toolbar component replacing the current header row
- Saved-views tab strip (localStorage now, Postgres-ready interface)
- Multi-select checkboxes column in the table
- Bulk action bar (stop/resume/terminate/delete/add tag)
- Status cells: dot indicator + label instead of badge
- Transformation column: type glyphs (I/D/F/T) + text label
- DLQ column: color-coded (zero = muted, warn = yellow, critical = red)
- Name cell: inline error/warn reason as a sub-line
- Row left-border tinting for error/warn status rows
- Density toggle (Table / Hybrid / Cards) — Hybrid and Cards are no-ops for now, toggle state stored in hook
- Redesigned empty state with quick-start template cards

### What stays untouched
- `PipelinesTable.tsx` — CSS grid, column definitions interface, sort logic (checkbox column added via config)
- `TableContextMenu.tsx` — all actions, demo mode, loading states
- `usePipelineListOperations.ts` — all handlers, confirm logic
- SSE/polling hooks (`usePipelineStateAdapter`, `usePipelineMonitoring`, `usePipelineOperations`)
- All modals (Stop, Terminate, Rename, Edit, Tags, Delete, Download)
- `useFiltersFromUrl` + filter URL sync
- `MobilePipelinesList.tsx`
- `PipelinesPageClient.tsx` (minor: swap NoPipelines → PipelinesEmptyState)

---

## New Files

### `src/modules/pipelines/hooks/useSavedViews.ts`

Manages the saved-views tab strip.

**State:**
- `views: SavedView[]` — list of views
- `activeViewId: string` — currently selected view ID

**Types:**
```ts
type SavedView = {
  id: string
  name: string
  filters: FilterState        // reuses existing FilterState type
  isBuiltIn: boolean          // built-in views cannot be deleted
}
```

**Built-in views (always present, non-deletable):**
- `all` — no filters, label "All"
- `running` — status: ['active'], label "Running"
- `dlq-watch` — derived: pipelines with DLQ > 0, label "DLQ watch"
- `stopped` — status: ['stopped', 'terminated'], label "Stopped"

**Persistence:** `localStorage` key `gf_pipeline_views`. On mount, merges built-in views with any user-saved views from localStorage. When a user saves a view, it writes to localStorage.

**API interface (Postgres-ready):** The hook accepts an optional `adapter?: SavedViewsAdapter` prop. When provided, load/save/delete operations call the adapter instead of localStorage. The adapter interface:
```ts
interface SavedViewsAdapter {
  load(): Promise<SavedView[]>
  save(view: SavedView): Promise<void>
  delete(viewId: string): Promise<void>
}
```
This makes the swap to Postgres a single-file change with no component updates.

**Actions:**
- `selectView(id)` — sets active view, applies its filters via `onFiltersChange`
- `saveCurrentView(name, filters)` — creates new user view, persists
- `deleteView(id)` — removes user view (built-ins protected)

**Pipeline count per view:** The hook receives `filteredCountForView(filters: FilterState) => number` callback from `PipelinesList` to compute counts displayed on tabs.

---

### `src/modules/pipelines/hooks/useBulkSelection.ts`

Manages multi-select state.

**State:**
- `selectedIds: Set<string>`

**Actions:**
- `toggleRow(id)` — select/deselect one pipeline
- `toggleAll(ids)` — select all if none selected, deselect all if any selected
- `clearSelection()` — deselect all
- `isSelected(id): boolean`
- `selectedCount: number`
- `allSelected(ids): boolean` — true if all visible ids are selected
- `someSelected: boolean` — true if 1+ selected (drives mixed-state checkbox in header)

**Behavior:** Selection is cleared automatically when filters change (prevents stale selection across view switches).

---

### `src/modules/pipelines/hooks/useListSearch.ts`

Manages the name search input.

**State:**
- `searchQuery: string`

**Actions:**
- `setSearchQuery(q: string)`
- `clearSearch()`

**Output:**
- `filterBySearch(pipelines: ListPipelineConfig[]): ListPipelineConfig[]` — filters pipelines whose `name` contains the query (case-insensitive). Returns full list when query is empty.

Search is applied after the existing status/health/tag filters, not instead of them.

---

### `src/modules/pipelines/components/PipelinesToolbar.tsx`

Replaces the current inline header controls in `PipelinesList`.

**Props:**
```ts
{
  searchQuery: string
  onSearchChange: (q: string) => void
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  availableTags: string[]
  densityMode: 'table' | 'hybrid' | 'cards'
  onDensityChange: (mode: 'table' | 'hybrid' | 'cards') => void
  filterButtonRef: React.RefObject<HTMLButtonElement>
  isFilterMenuOpen: boolean
  onFilterMenuToggle: () => void
}
```

**Layout:** Search bar (flex-grow) → active filter chips → spacer → density toggle. The existing `PipelineFilterMenu` is positioned relative to `filterButtonRef` as before.

---

### `src/modules/pipelines/components/SavedViewsStrip.tsx`

Tab strip rendered between the page title row and toolbar.

**Props:**
```ts
{
  views: SavedView[]
  activeViewId: string
  onSelectView: (id: string) => void
  onSaveCurrentView: (name: string) => void
  onDeleteView: (id: string) => void
  getPipelineCount: (view: SavedView) => number
}
```

**Behavior:** Renders a horizontal scrollable tab list. Each tab shows name + pipeline count badge. Active tab has orange underline. Built-in tabs are not deletable. "+ Save view" button at the end opens an inline popover with a name input and confirm/cancel.

---

### `src/modules/pipelines/components/BulkActionBar.tsx`

Appears above the table when `selectedCount > 0`.

**Props:**
```ts
{
  selectedCount: number
  totalVisible: number
  onStop: () => void
  onResume: () => void
  onTerminate: () => void
  onDelete: () => void
  onAddTag: () => void
  isLoading: boolean
}
```

**Layout:** `{n} selected of {m} visible` → spacer → action buttons. Buttons: Stop, Resume, Terminate, Add tag, Delete (danger style). All buttons disabled when `isLoading`.

**Bulk operation flow:** Each action calls the corresponding handler in `PipelinesList`, which iterates `selectedIds`, calls the existing per-pipeline operation (reusing `usePipelineListOperations` handlers), then clears selection on completion.

---

### `src/modules/pipelines/components/PipelinesEmptyState.tsx`

Replaces `NoPipelines`.

**Layout:**
- Pipeline glyph visualization (I → T → S nodes with connectors)
- Title: "No pipelines yet"
- Body: brief description
- 3 CTAs: "Create from scratch" → `/home`, "Import config" → upload modal, "Create with AI" → `/pipelines/create/ai`
- Quick-start template cards (3 cards: dedup, filter, direct ingest) — clicking navigates to `/home` (wizard handles template selection in a future iteration)

---

## Modified Files

### `src/modules/pipelines/columns/pipelineListColumns.tsx`

**Checkbox column** (key: `select`, width: `36px`, non-sortable):
```tsx
render: (pipeline) => (
  <div onClick={(e) => { e.stopPropagation(); onToggleSelect(pipeline.pipeline_id) }}>
    <Checkbox checked={isSelected(pipeline.pipeline_id)} />
  </div>
)
```
Added as the first column. `PipelineListColumnsConfig` gains `onToggleSelect` and `isSelected`.

**Status column:** Replace `<Badge>` with dot + label:
```tsx
<div className="flex items-center gap-2">
  <span className="status-dot" data-status={effectiveStatus} />
  <span className="font-mono text-xs">{getPipelineStatusLabel(effectiveStatus)}</span>
</div>
```
Status dot colors via CSS tokens (no hardcoded colors).

**Transformation column:** Add type glyphs before the text label. Parse `transformation_type` string to derive glyph sequence:
- Always includes `I` (ingest)
- `dedup` in type → `D`
- `filter` in type → `F`
- `transform` in type → `T`
- `join` in type → `J`

**DLQ column:** Color-code the count:
- `0` → `text-[var(--color-foreground-neutral-faded)]`
- `1–99` → `text-[var(--color-foreground-warning)]` (yellow)
- `100+` → `text-[var(--color-foreground-critical)]` (red) + `font-bold`

**Name column:** Add optional sub-line for error/warn context:
```tsx
<div className="flex flex-col gap-0.5">
  <span className="font-medium">{pipeline.name}</span>
  {pipeline.health_status === 'unstable' && pipeline.dlq_stats?.unconsumed_messages > 0 && (
    <span className="text-xs font-mono text-[var(--color-destructive)]">
      {pipeline.dlq_stats.unconsumed_messages.toLocaleString()} events in DLQ
    </span>
  )}
</div>
```

### `src/modules/pipelines/PipelinesTable.tsx`

Add `rowClassName?: (item: ListPipelineConfig) => string` prop. `PipelinesList` passes a function that checks `effectiveStatus` and `health_status`:
- Red tint: `effectiveStatus === 'failed'` → `"border-l-2 border-[var(--color-foreground-critical)] bg-[color-mix(in_srgb,var(--color-foreground-critical)_4%,transparent)]"`
- Yellow tint: `pipeline.health_status === 'unstable' && effectiveStatus !== 'failed'` → `"border-l-2 border-[var(--color-foreground-warning)] bg-[color-mix(in_srgb,var(--color-foreground-warning)_3%,transparent)]"`
- `""` otherwise

### `src/modules/pipelines/PipelinesList.tsx`

**New state/hooks added:**
- `const [densityMode, setDensityMode] = useState<'table'|'hybrid'|'cards'>('table')`
- `const search = useListSearch()`
- `const bulk = useBulkSelection()`
- `const savedViews = useSavedViews({ onFiltersChange: setFilters, initialFilters: filters })`

**Filter pipeline changes:** `filteredPipelines` memo now also passes through `search.filterBySearch()`.

**Bulk operations:** Add `handleBulkStop`, `handleBulkResume`, `handleBulkTerminate`, `handleBulkDelete`, `handleBulkAddTag` — each iterates `bulk.selectedIds`, calls the per-pipeline handler from `usePipelineListOperations`, then `bulk.clearSelection()`.

**Bulk add tag:** Opens a new `BulkTagModal` (not the single-pipeline `PipelineTagsModal`) — a lightweight modal with a tag input that adds specified tags to all selected pipelines. Calls `updatePipelineMetadata` for each, merging new tags with each pipeline's existing tags (deduplicating). This requires one new file: `src/modules/pipelines/components/BulkTagModal.tsx`.

**Column config:** Pass `onToggleSelect: bulk.toggleRow` and `isSelected: bulk.isSelected` to `getPipelineListColumns`.

**Rendered structure:**
```
<title row>
<SavedViewsStrip />
<PipelinesToolbar />
<PipelineFilterMenu />         ← existing, unchanged
{bulk.selectedCount > 0 && <BulkActionBar />}
<PipelinesTable rowClassName={...} />    ← desktop
<MobilePipelinesList />                  ← mobile (unchanged)
<modals...>                              ← all existing, unchanged
```

---

## Saved Views — Postgres Migration Path

When the backend API is ready, implement `PostgresSavedViewsAdapter`:

```ts
class PostgresSavedViewsAdapter implements SavedViewsAdapter {
  async load() { return fetch('/ui-api/pipeline-views').then(r => r.json()) }
  async save(view) { return fetch('/ui-api/pipeline-views', { method: 'POST', body: JSON.stringify(view) }) }
  async delete(id) { return fetch(`/ui-api/pipeline-views/${id}`, { method: 'DELETE' }) }
}
```

Pass it to `useSavedViews({ adapter: new PostgresSavedViewsAdapter() })`. No component changes.

---

## CSS Tokens Needed

All new visual states must use tokens, no hardcoded colors.

| Visual need | Token to use |
|---|---|
| Status dot: active | `--color-foreground-positive` |
| Status dot: pausing/warn | `--color-foreground-warning` |
| Status dot: error/failed | `--color-foreground-critical` |
| Status dot: paused/stopped | `--color-foreground-neutral-faded` |
| DLQ warn (1–99) | `--color-foreground-warning` |
| DLQ critical (100+) | `--color-foreground-critical` |
| Row tint: error | `color-mix(in srgb, var(--color-foreground-critical) 4%, transparent)` |
| Row tint: warn | `color-mix(in srgb, var(--color-foreground-warning) 3%, transparent)` |
| Type glyph I | `--color-foreground-info` (blue) |
| Type glyph D | `--color-purple-300` (add token if missing) |
| Type glyph F | `--color-foreground-positive` |
| Type glyph T | `--color-foreground-primary` (orange) |
| Type glyph J | `--color-foreground-warning` |

If tokens don't exist yet, add them per CLAUDE.md rule 7 before using.

---

## Tests

- `useSavedViews.test.ts` — built-in views always present; user view CRUD; adapter interface; selection clears on filter change
- `useBulkSelection.test.ts` — toggle, toggleAll, clearSelection, someSelected, allSelected
- `useListSearch.test.ts` — filters by name case-insensitively; returns full list on empty query
- `PipelinesToolbar.test.tsx` — renders search, filter chips, density toggle; callbacks fire
- `BulkActionBar.test.tsx` — buttons disabled when isLoading; count display; all 5 action callbacks
- `pipelineListColumns.test.tsx` — extend existing tests: checkbox column render, type glyph derivation, DLQ color thresholds, status dot variant

---

## Out of Scope

- Group by team / group by health (requires team/owner data not in current API)
- Throughput sparklines (requires new backend metrics endpoint)
- Source → Sink column (deferred)
- Env badge (deferred)
- Hybrid / Cards density modes (toggle is wired, but only Table is functional)
- Pagination (deferred — virtual scroll future iteration)
