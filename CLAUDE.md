# clickhouse-etl

GlassFlow's core ETL engine — streams data from Kafka into ClickHouse with deduplication, joins, filtering, and schema mapping. The main binary (`glassflow-api`) selects its role at runtime via a `-role` flag.

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
Kafka → Ingestor → NATS JetStream → [Dedup] → [Join] → [Transform/Filter] → Sink → ClickHouse
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

## Git & PR conventions

- Branch naming follows Linear ticket ID: `ETL-XYZ` or `username/ETL-XYZ-description`
- Backend changes reviewed by: Petr, Pablo, Kiran
- Frontend changes reviewed by: Vladimir (sole frontend dev)
- No `Co-Authored-By: Claude` or AI attribution in commits/PRs

## Configuration

Components are configured via environment variables (envconfig pattern). PostgreSQL stores persistent pipeline config. NATS KV is used for runtime metadata (legacy).

## Domain context

For glossary, architecture diagrams, customer personas, and cross-repo workflows see the shared context repo (sibling directory):

```
../glassflow-agent-context/
  domain/glossary.md              # Key terms and definitions
  domain/data-model.md            # Core data structures
  domain/deployment-topology.md   # How components fit together in prod
  projects/clickhouse-etl/        # Architecture, local-dev, gotchas
  workflows/linear-tickets.md     # Ticket → branch → PR flow
```

Load these on demand when doing design work, writing PR descriptions, or when domain terminology is ambiguous. Don't load them for routine code tasks.
