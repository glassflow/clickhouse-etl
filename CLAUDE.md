# clickhouse-etl

GlassFlow's core ETL engine — streams data from multiple sources into ClickHouse with deduplication, joins, filtering, and schema mapping. The main binary (`glassflow-api`) selects its role at runtime via a `-role` flag.

## Repo layout

```
glassflow-api/          # Core ETL binary and REST API
  cmd/                  # Entry point (main.go)
  internal/
    api/                # HTTP endpoints (Huma v2)
    ingestor/           # Kafka consumer (franz-go)
    sink/               # ClickHouse batch writer (clickhouse-go v2)
    join/               # Temporal stream joining
    deduplication/      # Stateful dedup (BadgerDB v4)
    transformer/        # Stateless transforms (expr engine)
    filter/             # Event filtering
    stream/             # NATS JetStream subscriber abstraction
    orchestrator/       # Kubernetes + local orchestration
    service/            # Business logic
    storage/            # PostgreSQL persistence (pgx v5)
    models/             # Config structs
    schema/             # JSON schema mapping
  tests/                # E2E tests (Cucumber/Gherkin)
  migrations/           # DB migrations
ui/                     # Next.js frontend (see ui/CLAUDE.md)
nats-kafka-bridge/      # NATS↔Kafka bridge service
```

## Data flow

```
Source Connector → Ingestor → NATS JetStream → [Dedup] → [Join] → [Transform/Filter] → Sink → ClickHouse
                                                                               ↓
                                                                        Dead-Letter Queue
```

Each stage is a separate container but the same binary — role is set via `-role sink|join|ingestor|dedup`.

## Commands

```bash
# From repo root
make run                  # Run glassflow-api locally
make build                # Build binary

# From glassflow-api/
make build                # Build binary
make run                  # Run service
make run-test             # Unit tests with -race
make run-short-test       # Short tests only
make run-e2e-test         # End-to-end tests
make lint                 # golangci-lint v2.6.2
make pre-push-check       # Full suite (run before pushing)

# Single test
go test ./internal/... -run TestFunctionName -race
```

## Key technology choices

| Purpose | Library |
|---------|---------|
| REST API | Huma v2 |
| Kafka consumer | franz-go |
| ClickHouse writer | clickhouse-go v2 |
| Messaging | NATS JetStream |
| Expressions | expr (antonmedv/expr) |
| Dedup state | BadgerDB v4 |
| Pipeline config | PostgreSQL + pgx v5 |
| Observability | OpenTelemetry + slog/tint |

## Local dev & testing

The API is exposed at `http://localhost:8081` when running locally via the CLI:

```bash
glassflow up              # Start local Kind cluster + all services
glassflow up --demo       # Start + load demo data
glassflow down            # Tear down
```

Test payloads live in `glassflow-api/bin/*.json`. Create a pipeline:

```bash
curl -v http://localhost:8081/api/v1/pipeline \
  -X POST -H 'Content-Type: application/json' \
  --data @glassflow-api/bin/<payload>.json
```

## Testing

### Unit tests (`internal/`)

Unit tests live alongside the code they test (`*_test.go` in the same package). They use `testing` + `testify/require` and run with `-race`. Write table-driven tests (`[]struct{ name, input, want }`) for pure logic; use real embedded dependencies (BadgerDB, in-process NATS) rather than mocks wherever practical.

```bash
go test ./internal/... -race                        # all unit tests
go test ./internal/... -run TestFunctionName -race  # single test
make run-short-test                                 # short/fast subset only
```

### E2E tests (`tests/`)

E2E tests are BDD-style using **Cucumber/Godog**. Feature files (`.feature`) live in `tests/features/<domain>/` (e.g. `sink`, `join`, `pipeline`, `ingestor`, `backpressure`). Step implementations live in `tests/steps/`. Each suite has a `SetupResources`/`CleanupResources` lifecycle and is tagged (e.g. `@sink`, `@join`).

- Run all suites: `make run-e2e-test`
- Run a specific suite by tag: `TEST_TAGS=@sink go test ./tests/... -v`
- New feature scenarios belong in the matching `features/<domain>/` directory; new domains get a new subdirectory + suite registered in `tests/main_test.go`

### Pre-push gate for glassflow-api changes

**Before opening a PR for any changes in `glassflow-api/`, always run:**

```bash
cd glassflow-api
make run-test       # unit tests with -race
make run-e2e-test   # full E2E suite
```

Both must pass. `make pre-push-check` runs the full suite including lint.

## Git & PR conventions

- Branch naming follows Linear ticket ID: `ETL-XYZ` or `username/ETL-XYZ-description`
- Backend changes reviewed by: Petr, Pablo, Kiran
- Frontend changes reviewed by: Vladimir (sole frontend dev)
- No `Co-Authored-By: Claude` or AI attribution in commits/PRs

### Starting work on a new ticket

**Always branch from `main`.** Before creating a branch, run:

```bash
git checkout main
git pull origin main
git checkout -b username/ETL-XYZ-short-description
```

Never start a ticket branch from another feature branch. If the current working directory is on a non-main branch when a ticket is requested, check out main and pull before creating the new branch. Skipping this causes the PR to include unrelated commits from the prior branch.

## Configuration

Components are configured via environment variables (envconfig pattern). PostgreSQL stores persistent pipeline config. NATS KV is used for runtime metadata (legacy).

## Domain context

The shared context repo lives at `../glassflow-agent-context/` (sibling directory). Read files from it when:

- **Implementing a feature or ticket** → read `../glassflow-agent-context/workflows/linear-tickets.md` before branching
- **Writing a PR description** → read `../glassflow-agent-context/prompts/pr-description.md`
- **Domain terminology is ambiguous** → read `../glassflow-agent-context/domain/glossary.md`
- **Designing a new component or data flow** → read `../glassflow-agent-context/projects/clickhouse-etl/architecture.md` and `domain/deployment-topology.md`
- **Writing new E2E scenarios** → look at an existing feature file in `glassflow-api/tests/features/` for style conventions before adding a new one

Don't load these for routine bug fixes or code tasks — read the code directly instead.
