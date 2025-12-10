# Component Architecture

## Hierarchy

```
components/ui/          # Base shadcn/radix primitives (do not modify)
components/common/      # Reusable, app-agnostic UI patterns
components/shared/      # App-wide/shared components with light domain context
modules/*/components/   # Feature-specific components
```

### components/ui/

- Source of truth for primitives (Button, Input, Dialog, Form, etc.).
- Do not change behaviors/styles unless aligning with shadcn updates.
- Used as building blocks for higher layers.

### components/common/

- Reusable patterns with no tight domain coupling.
- Examples: `FormModal`, `SearchableSelect`, `InputFile`, `StatusBadge`.
- Use when component is used in 2+ domains and stays domain-neutral.

### components/shared/

- App-level/shared pieces that may carry light business context.
- Examples: `Header`, `ThemeProvider`, `EventEditor`, `ConsentDialog`.
- Use when used across app but not generic enough for `common/`.

### modules/\*/components/

- Feature/domain-specific components.
- Examples: `KafkaConnectionFormManager`, `ClickhouseMapper`, `FilterConfigurator`.
- Keep business logic closest to the domain; avoid cross-module coupling.

## Composition Patterns

### Container/Presenter

- Container handles data fetching, store interaction, side effects.
- Presenter focuses on rendering and minimal UI logic.
- Example: `KafkaConnectionContainer` (container) → `KafkaConnectionFormManager` (presenter).

### Manager/Renderer (Forms)

- Manager owns form setup, validation, submit/discard logic.
- Renderer renders fields using form context.
- Example: `KafkaConnectionFormManager` → `KafkaConnectionFormRenderer`.

### Config-Driven Rendering

- Form and UI components can be driven by configs (see `src/config/*`).
- Prefer configs for repeatable patterns (field definitions, groups, options).

## Conventions

- File/component naming: PascalCase (e.g., `FormModal.tsx`).
- Props interfaces: `ComponentNameProps`.
- Group related subcomponents in same file when small; otherwise split.
- Keep `'use client'` only where hooks/DOM APIs are needed.

## When to Choose a Layer

- `ui/`: Never new primitives; only extend if aligning with shadcn upgrade.
- `common/`: Reusable, domain-neutral UI used in multiple features.
- `shared/`: App-wide/shared with light domain logic (layout, providers).
- `modules/*/components/`: Domain-specific or single-feature use.

## Testing/Usage Notes

- Prefer visual/stateful behaviors driven by props; avoid internal hidden state unless UI-only.
- Keep side effects in containers/hooks, not presenters.
- Reuse utilities from `src/utils` and store from `src/store` via hooks, not via prop drilling where global state is expected.

## Related Docs

- Architecture Overview: ./ARCHITECTURE_OVERVIEW.md
- Module Architecture: ./MODULE_ARCHITECTURE.md
- Form Architecture: ./FORM_ARCHITECTURE.md
