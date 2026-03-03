# Design Workflow

How design (Figma) and code stay in sync for the ClickHouse ETL UI.

## Tokens

- **Source of truth:** Design tokens are defined in `src/themes/base.css` (primitives, layout, typography) and `src/themes/theme.css` (semantic and component colors for dark theme).
- **Figma:** Variable names in Figma should match [FIGMA_TOKEN_REFERENCE.md](./FIGMA_TOKEN_REFERENCE.md). After changing tokens in CSS, run the sync script so Figma variables are updated:
  - From repo root: `npm run sync-tokens`
  - Requires `FIGMA_ACCESS_TOKEN` and `FIGMA_FILE_KEY` (see `scripts/sync-tokens-to-figma/README.md` and `src/themes/FIGMA-SYNC-INSTRUCTIONS.md`).

## Components

- **Code primitives:** Button, Input, Textarea, SelectTrigger, Switch, Card, Badge, etc. in `src/components/ui/` own all visual states and use semantic props (`variant`, `error`, `readOnly`). See `.cursor/architecture/UI_AND_STYLING.md`.
- **Code Connect:** Use Figma’s Code Connect to map Figma components to these code components (e.g. Figma Button/Primary → `@/src/components/ui/button.tsx` / `Button` with `variant="primary"`). That keeps “implement from Figma” and “match design” aligned and helps agents use the right primitives.
- **Design system rules:** The Figma MCP’s `create_design_system_rules` can generate design system rules from the codebase. Combine with the hand-written `.cursor/architecture/UI_AND_STYLING.md` and `.cursor/styling.mdc` so design-from-Figma and implement-with-primitives are both guided.

## Iteration

- Change design in Figma using the same variable set; implement in code using existing primitives and variants.
- Token sync is one-way (code → Figma variables). Code Connect links Figma components to code; there is no separate “push component API to Figma” step.
