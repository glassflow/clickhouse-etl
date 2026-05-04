# Persistence Layer — Testing & Deployment

Captured 2026-05-04 while investigating how to test branch `ui-ux-revamp-2.0` end-to-end with the Postgres-backed library / AI-chats persistence introduced in earlier sprints.

This document maps the persistence surface area, the local + cluster test paths, and two real caveats in the chart wiring.

---

## 1. Where the persistence layer lives

The Postgres-backed library and AI-chats schema were merged in earlier sprints (≈ commits `19bce09b feat(ai): ai_chats table` and the Drizzle Library work in sprints A–E). `ui-ux-revamp-2.0` consumes that infrastructure but does not change it. The relevant files are all under `ui/src/lib/db/`:

| Layer | What's there | File |
|---|---|---|
| Driver | Postgres via `postgres-js`, SQLite (`better-sqlite3`) fallback when no `DATABASE_URL` | `ui/src/lib/db/index.ts` |
| Migrations | 4 SQL files (`0001_initial` → `0004_ai_chats`), Drizzle metadata in `meta/` | `ui/src/lib/db/migrations/` |
| Boot hook | Next.js `instrumentation.ts` calls `runMigrations()` once before any request is served | `ui/src/instrumentation.ts` |
| Schema | Drizzle definitions for library + revisions + AI chats | `ui/src/lib/db/schema.ts` |

### Two non-obvious behaviours

- **Migrations run inside the Next.js server process**, not as a separate init container the way the Go API does it. The UI pod just needs `DATABASE_URL` and a reachable Postgres at boot — but it also means the UI pod fails to start if migrations fail.
- The Dockerfile copies `src/lib/db/migrations` into the standalone image (`ui/Dockerfile:79-81`) so that `path.join(process.cwd(), 'src/lib/db/migrations')` resolves at runtime in the trimmed-down build.

---

## 2. Local testing

### Fastest path — SQLite fallback

```bash
cd ui && pnpm dev
```

With no `DATABASE_URL` set, the driver falls back to a local `.library.db` SQLite file in the working directory. Library / AI chat persistence works end-to-end against SQLite. This is the fastest way to click through the new Canvas, Logs, AI Drawer, and other Phase 1–8 work.

### Postgres path

```bash
docker run -d --name gf-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=pg \
  -e POSTGRES_USER=glassflow \
  -e POSTGRES_DB=glassflow \
  postgres:17-alpine

DATABASE_URL=postgresql://glassflow:pg@localhost:5432/glassflow pnpm dev
```

On first boot watch the server log — Drizzle should apply migrations 0001–0004. After that, `psql` will show the populated tables (`pipeline_revisions`, `library_kafka_connections`, `library_clickhouse_connections`, `library_schemas`, `library_transformations`, `ai_chats`).

---

## 3. Helm deployment — charts repo state

The charts repo at `~/Documents/code/glassflow/charts` (`main`, chart `glassflow-etl@0.5.16`, app `3.0.0`) has the Postgres wiring done:

- `postgresql` (0.1.9) and `pgbouncer` (0.1.0) added as subchart deps (`charts/glassflow-etl/Chart.yaml:33-44`).
- UI deployment injects `DATABASE_URL` from the `glassflow-postgresql` secret (commit `7fd1713 feat(ui): inject DATABASE_URL and wait-for-postgres init container`, `templates/deployment.yaml:79-94`).
- A `wait-for-postgres` busybox init container blocks UI startup until Postgres listens, so Drizzle migrations don't race the Postgres pod (lines 41-55 of the same template).
- Three-way fallback for `DATABASE_URL`: internal `postgresql.enabled` → literal `global.postgres.connection_url` → external `global.postgres.secret`.

For the **default case** (`postgresql.enabled=true`, `global.pgbouncer.enabled=false`) the chart needs no further changes to deploy this branch. There are two real caveats though.

### Caveat 1 — UI image tag must be rebuilt

`charts/glassflow-etl/values.yaml:189` pins `ui.image.tag: v3.0.0`. The `glassflow-etl-fe` image is only pushed to GHCR by:

- `.github/workflows/main.yaml` on push to `main` (this branch hasn't merged)
- `.github/workflows/tag.yaml` on a release tag

Feature branches do not auto-publish a UI image. Before any Helm install of `ui-ux-revamp-2.0` can pick up the Phase 1–8 work, a fresh image is required. Two options:

```bash
# Option A: open the PR and rerun the workflow with a release-candidate tag (rc_tag input)

# Option B: build & push manually
cd ui
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/glassflow/glassflow-etl-fe:ui-ux-revamp-2.0 \
  --push .
```

Then point Helm at the rebuilt image with `--set ui.image.tag=ui-ux-revamp-2.0`.

### Caveat 2 — pgbouncer mode is only half-wired for the UI

When `global.pgbouncer.enabled=true`, the chart routes the **API**'s migration init container at `direct-connection-url` (`templates/deployment.yaml:266-268`), but the **UI**'s `DATABASE_URL` still points at pgbouncer. Drizzle migrations going through pgbouncer's transaction-level pooling can fail (`postgres-js` uses advisory locks during `migrate()`).

The API works around this by running migrations in a separate `run-migration` init container that uses a direct URL. The UI does migrations inline in its server process, so it has nowhere clean to read a "direct" URL from today.

To support pgbouncer cleanly in future, either:

- (a) Add a `DATABASE_URL_DIRECT` env in the UI, have `runMigrations()` prefer it over `DATABASE_URL`, and inject `direct-connection-url` in the chart. Or
- (b) Split UI migrations into a dedicated init container that mirrors the API's pattern.

For now, **deploy with `global.pgbouncer.enabled=false`** to test this branch. That is the supported path.

---

## 4. Recommended testing recipe

```bash
# Build & push the UI image
cd ui
docker buildx build --platform linux/amd64 \
  -t ghcr.io/glassflow/glassflow-etl-fe:ui-ux-revamp-2.0 \
  --push .

# In the charts repo
cd ~/Documents/code/glassflow/charts
helm dependency build charts/glassflow-etl

helm upgrade --install gf charts/glassflow-etl \
  --create-namespace -n glassflow \
  --set postgresql.enabled=true \
  --set global.pgbouncer.enabled=false \
  --set ui.image.tag=ui-ux-revamp-2.0

# Verify migrations ran
kubectl -n glassflow logs deployment/gf-ui | grep -i drizzle
kubectl -n glassflow exec -it sts/gf-postgresql -- \
  psql -U glassflow -d glassflow -c '\dt'
# Expected tables: pipeline_revisions, library_kafka_connections,
# library_clickhouse_connections, library_schemas, library_transformations, ai_chats
```

---

## 5. Action checklist

| # | Action | Status / Owner |
|---|---|---|
| 1 | Local SQLite sanity check (`pnpm dev`) | Anyone, anytime |
| 2 | Local Postgres path with Docker `postgres:17-alpine` | Anyone, anytime |
| 3 | Build & push `glassflow-etl-fe:<branch-tag>` to GHCR | Required before cluster install of this branch |
| 4 | `helm install` with `postgresql.enabled=true`, `global.pgbouncer.enabled=false` | Cluster smoke test |
| 5 | Charts follow-up: wire `DATABASE_URL_DIRECT` for the UI | Not blocking; track separately if pgbouncer is needed for UI |

---

## 6. References

- Persistence code: `ui/src/lib/db/{index,migrate,schema}.ts`, `ui/src/instrumentation.ts`
- Migrations: `ui/src/lib/db/migrations/`
- UI Dockerfile: `ui/Dockerfile`
- Charts repo: `~/Documents/code/glassflow/charts` (chart: `charts/glassflow-etl/`)
- Key chart commits: `7fd1713 feat(ui): inject DATABASE_URL and wait-for-postgres init container`, `3662cde fix(helm): add pgbouncer to Chart.lock`
- CI image build: `.github/workflows/build_image.yaml` (UI job: `build-frontend-image`)
- Library architecture context: `ui/docs/architecture/LIBRARY.md`
