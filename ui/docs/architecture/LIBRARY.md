# Library — Architecture Reference

The Library is a persistent store of reusable Kafka connections, ClickHouse connections, and schema definitions. It lets engineers save a tested connection once and prefill any pipeline that needs the same endpoint.

---

## Database layer

**ORM**: Drizzle ORM with two runtime backends depending on environment.

| Env | Driver | Storage |
|-----|--------|---------|
| `DATABASE_URL` set | `postgres-js` | Postgres |
| No `DATABASE_URL` | `better-sqlite3` | `.library.db` (local file) |

Both drivers are loaded with `require()` at runtime so neither is bundled when unused. The returned client is typed as `PostgresJsDatabase<Schema>` in both cases — callers use one unified API surface.

**Client factory**: `src/lib/db/index.ts`

```ts
export const db: PostgresJsDatabase<Schema> = createDb()
export type DbClient = PostgresJsDatabase<Schema>
```

**Migration runner**: `src/lib/db/migrate.ts`

`runMigrations()` selects the correct `drizzle-orm/**/migrator` at runtime (same Postgres/SQLite fork). Migration files live in `src/lib/db/migrations/`. The initial migration is `0001_initial.sql`. Call `runMigrations()` from your server startup path; Next.js does not auto-run it.

### Schema tables

All tables live inside the `ui_library` Postgres schema (`pgSchema('ui_library')`).

**`folders`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `defaultRandom()` |
| `name` | text | required |
| `parentId` | uuid | self-referencing, nullable (root folder) |
| `createdAt` | timestamp | |

**`kafka_connections`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | required |
| `description` | text | nullable |
| `folderId` | uuid FK → `folders.id` | `onDelete: set null` |
| `tags` | jsonb `string[]` | |
| `config` | jsonb `KafkaConfig` | full connection config |
| `createdAt` / `updatedAt` | timestamp | |

**`clickhouse_connections`** — same shape as `kafka_connections`, `config` typed as `ClickHouseConfig`.

**`schemas`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` / `description` | text | |
| `folderId` | uuid FK → `folders.id` | `onDelete: set null` |
| `tags` | jsonb `string[]` | |
| `fields` | jsonb `SchemaField[]` | `{ name, type, nullable }[]` |
| `createdAt` / `updatedAt` | timestamp | |

**Validation schemas** (`src/lib/db/validations.ts`): Zod objects for Create/Update of each resource. `config` is validated as `z.record(z.unknown())` at the API boundary; Drizzle's `$type<>` enforces the concrete shape at the query layer.

---

## API routes

All routes are under `src/app/ui-api/library/`. No auth middleware — library routes are publicly accessible within the app (protected at the network level in production).

### Folders

| Method | Path | Action |
|--------|------|--------|
| GET | `/ui-api/library/folders` | List all folders, ordered by `createdAt` asc |
| POST | `/ui-api/library/folders` | Create a folder (`CreateFolderInput`) |

### Kafka connections

| Method | Path | Action |
|--------|------|--------|
| GET | `/ui-api/library/connections/kafka` | List all, ordered by `createdAt` asc |
| POST | `/ui-api/library/connections/kafka` | Create (`CreateKafkaConnectionInput`) — 201 |
| GET | `/ui-api/library/connections/kafka/[id]` | Fetch single by UUID — 404 if missing |
| PUT | `/ui-api/library/connections/kafka/[id]` | Update (`UpdateKafkaConnectionInput`), sets `updatedAt` |
| DELETE | `/ui-api/library/connections/kafka/[id]` | Hard delete — 404 if missing |

### ClickHouse connections

Identical shape to Kafka, path prefix `/ui-api/library/connections/clickhouse`.

### Schemas

| Method | Path | Action |
|--------|------|--------|
| GET | `/ui-api/library/schemas` | List all, ordered by `createdAt` asc |
| POST | `/ui-api/library/schemas` | Create (`CreateSchemaInput`) — 201 |
| GET | `/ui-api/library/schemas/[id]` | Fetch single — 404 if missing |
| PUT | `/ui-api/library/schemas/[id]` | Update (`UpdateSchemaInput`) |
| DELETE | `/ui-api/library/schemas/[id]` | Hard delete |

All routes return `{ error: string }` with the appropriate HTTP status on failure. Validation failures return 400 with `{ error: ZodError.flatten() }`.

---

## UI layer

### Library page components (`src/modules/library/components/`)

```
LibraryClient.tsx           — root client component; owns all state
  FolderTree.tsx            — left sidebar; folder tree with selection
  ConnectionsList.tsx       — generic card list for Kafka and ClickHouse rows
  SchemaList.tsx            — card list for schema rows
  KafkaConnectionFormModal.tsx    — create/edit modal for Kafka
  ClickHouseConnectionFormModal.tsx — create/edit modal for ClickHouse
```

**`LibraryClient`** manages three tabs (`kafka` | `clickhouse` | `schemas`), a search input, and folder filtering. Data is fetched via hooks from `src/hooks/useLibraryConnections.ts`.

### Data hooks (`src/hooks/useLibraryConnections.ts`)

```ts
useKafkaConnections()     → FetchState<KafkaConnection[]>
useClickhouseConnections()→ FetchState<ClickhouseConnection[]>
useLibrarySchemas()       → FetchState<LibrarySchema[]>
useLibraryFolders()       → FetchState<LibraryFolder[]>
```

Each hook wraps a minimal `useLibraryFetch<T>(url)` implementation (no SWR dependency) that exposes `{ data, isLoading, error, mutate }`. Call `mutate()` after a write to re-fetch.

---

## Wizard integration

Two common components inject the library into the wizard connection steps.

### `UseSavedConnectionChips` (`src/components/common/UseSavedConnectionChips.tsx`)

Renders a row of `<Button variant="outline">` chips, one per saved connection. On mount it fetches the appropriate list endpoint. Clicking a chip calls `onSelect(conn.config)`, which the host container merges into form state.

```ts
interface UseSavedConnectionChipsProps {
  connectionType: 'kafka' | 'clickhouse'
  onSelect: (config: Record<string, unknown>) => void
}
```

Renders nothing when the list is empty or still loading — zero visual noise when the library is unpopulated.

### `SaveToLibraryPrompt` (`src/components/common/SaveToLibraryPrompt.tsx`)

An inline card that appears after a successful connection test. The user types a name and presses Save, which `POST`s to the relevant library endpoint. On success the card shows a confirmation for 2 s then dismisses.

```ts
interface SaveToLibraryPromptProps {
  connectionType: 'kafka' | 'clickhouse'
  onSave: (name: string) => Promise<void>
  onDismiss: () => void
}
```

### Injection points

Both components are used in:

- `src/modules/kafka/KafkaConnectionContainer.tsx` — `UseSavedConnectionChips` above the form; `SaveToLibraryPrompt` shown via `showSavePrompt` state after a successful test.
- `src/modules/clickhouse/ClickhouseConnectionContainer.tsx` — same pattern.

The containers manage `prefillValues` state; `onSelect` from chips sets `prefillValues`, which the form manager uses as `initialValues`.

---

## Extending — adding a new connection type

1. **Schema** (`src/lib/db/schema.ts`): add a new `uiLibrary.table(...)` with `id`, `name`, `description`, `folderId`, `tags`, `config`, timestamps.
2. **Validation** (`src/lib/db/validations.ts`): add `CreateXxxInput` and `UpdateXxxInput` Zod schemas.
3. **Migration**: create a new `.sql` file in `src/lib/db/migrations/` with the `CREATE TABLE` statement inside `ui_library` schema.
4. **API routes**: create `src/app/ui-api/library/connections/xxx/route.ts` (list + create) and `src/app/ui-api/library/connections/xxx/[id]/route.ts` (get + put + delete) — copy the Kafka route as a template.
5. **Hook** (`src/hooks/useLibraryConnections.ts`): add `useXxxConnections()` calling `useLibraryFetch<XxxConnection[]>('/ui-api/library/connections/xxx')`.
6. **UI**: add a tab to `LibraryClient`, a form modal, and optionally extend `UseSavedConnectionChips` to support the new `connectionType`.
7. **Wizard container**: render `<UseSavedConnectionChips connectionType="xxx" ...>` and `<SaveToLibraryPrompt connectionType="xxx" ...>` in the connection step container.
