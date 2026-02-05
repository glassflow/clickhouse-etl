# Module Architecture

## Organization

Modules live under `src/modules/*` and encapsulate domain-specific UI/logic.

Notable modules:

- `kafka/` – Kafka connection & topic selection
- `clickhouse/` – ClickHouse connection/destination mapping
- `filter/` – Filter expression builder
- `join/` – Join configuration
- `deduplication/` – Deduplication config
- `transformation/` – Transformation config (passthrough, computed fields)
- `pipeline-adapters/` – Pipeline config version adapters (V1/V2)
- `pipelines/` – Pipeline list/details UI
- `notifications/` – Notification center (panel, settings, channels)
- `create/` – Pipeline wizard
- `review/` – Configuration review

## Structure (typical)

```
modules/<domain>/
  components/   # UI for the domain
  hooks/        # Domain-specific hooks
  types.ts      # Domain types
  utils.ts      # Helpers
  ...           # Containers/managers
```

## Principles

- Keep domain logic inside its module; avoid cross-module imports of internal pieces.
- Shared/generic pieces belong in `components/common` or `components/shared`.
- Use store slices for shared state; module components read/write via store actions.
- Use services/api helpers for side effects; keep components light.

## Containers vs Presenters

- Containers: orchestrate store + API + side effects.
- Presenters: render UI; minimal logic; accept data/handlers as props.

## Dependencies

- Prefer depending “down” (ui/common/shared → module), not across modules.
- If two modules need the same helper, move it to `src/utils` or `components/common`.

## Cross-Cutting Concerns

- Theme: rely on tokens; avoid hardcoded colors.
- Forms: follow Manager/Renderer split and schema/config-driven approach.
- State: use the appropriate slice; add new slice only when the domain is distinct.

## Related Docs

- Architecture Overview: ./ARCHITECTURE_OVERVIEW.md
- Component Architecture: ./COMPONENT_ARCHITECTURE.md
- State Management: ./STATE_MANAGEMENT.md
