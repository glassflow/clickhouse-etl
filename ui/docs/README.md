# Documentation Index

This folder is the **deep reference** for the ClickHouse ETL UI. For development rules and agent-facing context, use **`.cursor/`** as the entry point (rules in `.cursor/*.mdc`, short architecture in `.cursor/architecture/`). The docs here provide full architecture, design system, implementation notes, and per-module guides.

## Ownership

- **docs/** owns: canonical truth (full architecture, design system, module behavior, implementations).
- **.cursor/** owns: operational guidance (rules, concise summaries, pointers to docs).
- **Rule:** `.cursor/architecture/*` must not contain unique facts that do not exist here; only summaries and links. Canonical content lives in `docs/`.

## Architecture

| Doc | Description |
|-----|-------------|
| [architecture/ARCHITECTURE_OVERVIEW.md](architecture/ARCHITECTURE_OVERVIEW.md) | Full architecture: tech stack, directory tree, data flows, store structure, API, invariants, testing note. |
| [architecture/DESIGN_SYSTEM.md](architecture/DESIGN_SYSTEM.md) | Design system: base/theme/semantic layers, tokens, card variants, usage, migration. |

## Design

| Doc | Description |
|-----|-------------|
| [design/DESIGN_PRINCIPLES.md](design/DESIGN_PRINCIPLES.md) | Product and UX design principles, design process, brand and visual direction. |

## Implementations

| Doc | Description |
|-----|-------------|
| [implementations/SSE_PIPELINE_STATUS_STREAMING.md](implementations/SSE_PIPELINE_STATUS_STREAMING.md) | SSE-based real-time pipeline status; replaces client polling. |
| [implementations/KERBEROS_IMPLEMENTATION_SUMMARY.md](implementations/KERBEROS_IMPLEMENTATION_SUMMARY.md) | Kafka Kerberos auth and gateway. |
| [implementations/STORE_MODE_SUPPORT_PRD.md](implementations/STORE_MODE_SUPPORT_PRD.md) | Store mode support PRD. |

## Modules (per-feature guides)

| Module | Docs | Description |
|--------|------|-------------|
| Kafka | [modules/kafka/](modules/kafka/) | KAFKA_CONNECTION, KAFKA_TOPIC_SELECTION, KAFKA_TYPE_VERIFICATION. |
| ClickHouse | [modules/clickhouse/](modules/clickhouse/) | CLICKHOUSE_CONNECTION, CLICKHOUSE_MAPPING. |
| Filter | [modules/filter/](modules/filter/) | FILTER_CONFIGURATOR. |
| Join | [modules/join/](modules/join/) | JOIN_CONFIGURATOR. |
| Deduplication | [modules/deduplication/](modules/deduplication/) | DEDUPLICATION_CONFIGURATOR. |
| Transformations | [modules/transformations/](modules/transformations/) | TRANSFORMATION_CONFIGURATOR. |
| Pipelines | [modules/pipelines/](modules/pipelines/) | PIPELINE_DETAILS, PIPELINES_LIST. |
| Notifications | [modules/notifications/](modules/notifications/) | NOTIFICATIONS (notification center: panel, settings, channels). |

## How to use with agents/skills

- **Rules:** `.cursor/index.mdc` and `.cursor/*.mdc` (components, forms, api, state-management, styling, modules).
- **Context:** `.cursor/architecture/*.md` for short, agent-facing architecture; they link here for depth.
- **Deep detail:** Use this index to load the right doc (e.g. when working on Kafka, load `docs/modules/kafka/*` and the relevant `.cursor` rules).
