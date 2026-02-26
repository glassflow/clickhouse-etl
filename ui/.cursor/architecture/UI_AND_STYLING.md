# UI and Styling Architecture

Summary for agents and developers: how components own styling and how to use them. Full token and visual reference: [docs/architecture/DESIGN_SYSTEM.md](../../docs/architecture/DESIGN_SYSTEM.md) and [docs/design/FIGMA_TOKEN_REFERENCE.md](../../docs/design/FIGMA_TOKEN_REFERENCE.md).

## 1. Primitives own all visual states

Components in `components/ui/*` (Button, Input, Textarea, SelectTrigger, Switch, Card, Badge, etc.) **own all visual states**. They use design tokens (e.g. `--button-*`, `--control-*`) and internal classes or `data-slot` CSS. Do not duplicate their styling in call sites.

## 2. Consumers pass semantic props only

In `common/`, `shared/`, and `modules/*`: pass **semantic props only** — e.g. `variant`, `error`, `disabled`, `readOnly`. Use `className` only for **layout** (width, height, margin, grid/flex), not for control/button/card visual variants.

## 3. Do not use in app code

- **Input/Select styling:** `input-regular`, `input-border-regular`, `input-border-error` — the Input and SelectTrigger primitives apply these internally; pass `error={true}` and layout-only `className`.
- **Button styling:** `btn-primary`, `btn-text` — use `variant` and `size` (e.g. `variant="primary"`, `size="text"`).
- **Modal-only label/helper/error:** When FormItem/FormLabel/FormDescription/FormMessage or the same pattern (Label + Input + error paragraph with `input-description-error`) is available, use it instead of `modal-input-label`, `modal-input-helper`, `modal-input-error`.

## 4. Forms

Prefer **FormItem + FormLabel + FormControl + FormDescription/FormMessage** from `components/ui/form`. Use Input, Select, Textarea, Switch with `error` and `readOnly`; do not add manual border or state classes. For error text, use the `input-description-error` class or FormMessage.

## 5. Tokens

Prefer **component tokens** (`--button-*`, `--control-*`, `--surface-*`) and **semantic tokens** from FIGMA_TOKEN_REFERENCE.md / DESIGN_SYSTEM.md. Avoid raw hex or ad-hoc Tailwind semantic colors in UI.

## Design workflow (tokens and Figma)

- **Tokens:** Defined in `src/themes/base.css` and `src/themes/theme.css`. After changing design tokens, run the sync script so Figma variables stay in sync: from repo root, `npm run sync-tokens` (requires `FIGMA_ACCESS_TOKEN` and `FIGMA_FILE_KEY`). See `scripts/sync-tokens-to-figma/README.md` and `src/themes/FIGMA-SYNC-INSTRUCTIONS.md`.
- **Figma:** Variable names should align with [docs/design/FIGMA_TOKEN_REFERENCE.md](../../docs/design/FIGMA_TOKEN_REFERENCE.md). Use Code Connect to map Figma components to code primitives (Button, Input, Card, etc.) so implementation and design stay aligned.

## Related

- Theming: [THEMING_ARCHITECTURE.md](./THEMING_ARCHITECTURE.md)
- Styling rules: `.cursor/styling.mdc`
- Component hierarchy: [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)
- Design workflow summary: [docs/design/DESIGN_WORKFLOW.md](../../docs/design/DESIGN_WORKFLOW.md)
