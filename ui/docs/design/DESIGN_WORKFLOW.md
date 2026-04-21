# Design Workflow

How design (Figma) and code stay in sync for the ClickHouse ETL UI.

The system has two independent sync layers that work together:

| Layer | What it syncs | Script |
|---|---|---|
| **Token sync** | CSS variable values → Figma Variables | `pnpm sync-tokens` |
| **Code Connect** | React component props → Figma Dev Mode snippets | `pnpm figma:publish` |

---

## Layer 1 — Token sync

Design tokens are defined in CSS and pushed to Figma Variables so the design file always reflects the current production values.

**Source of truth:** Code → Figma (one direction)

### Token file locations

| File | Contains |
|---|---|
| `src/themes/base.css` | Primitive tokens in `:root`: raw colors, spacing units, border radius, typography scale, animation timing, z-index |
| `src/themes/theme.css` | Semantic and component tokens in `:root, [data-theme='dark']`: color mappings, button/card/control/surface/badge tokens, shadcn/ui bridge variables |

The `:root` selector ensures tokens are available immediately on page load (before React hydration sets `data-theme`). `[data-theme='dark']` keeps the explicit theme hook working for future light mode.

### Running the sync

```bash
# Dry run — extract tokens to JSON without calling Figma API
pnpm sync-tokens -- --dry-run

# Full sync — extract and push to Figma Variables
FIGMA_ACCESS_TOKEN=figd_xxx FIGMA_FILE_KEY=your_file_key pnpm sync-tokens
```

- `FIGMA_FILE_KEY` is the ID from the Figma file URL: `figma.com/design/{FILE_KEY}/...`
- Token requires `file_variables:read` and `file_variables:write` scopes
- Requires Figma Enterprise plan

Full instructions: [`figma-sync/sync-tokens-to-figma-via-api/README.md`](../../figma-sync/sync-tokens-to-figma-via-api/README.md)  
Token reference table: [`docs/design/FIGMA_TOKEN_REFERENCE.md`](./FIGMA_TOKEN_REFERENCE.md)

### Adding or changing a token

1. Add/edit the value in `src/themes/base.css` (primitives) or `src/themes/theme.css` (semantic/component)
2. Run `pnpm sync-tokens -- --dry-run` to verify the extracted JSON
3. Run the full sync to push to Figma
4. Update `docs/design/FIGMA_TOKEN_REFERENCE.md` if adding a new semantic token

---

## Layer 2 — Code Connect

Code Connect maps Figma components to React components so developers see the correct JSX snippet in Dev Mode when inspecting any component instance.

**Source of truth:** Code → Figma (one direction)

### Code Connect file locations

Each `.figma.tsx` file lives next to the component it describes:

| File | Maps |
|---|---|
| `src/components/ui/button.figma.tsx` | `<Button>` with all variants and sizes |
| `src/components/ui/badge.figma.tsx` | `<Badge>` with all variants |
| `src/components/ui/card.figma.tsx` | `<Card>` with all variants |
| `src/components/common/modal.figma.tsx` | `<InfoModal>` and `<ConfirmationModal>` |

### Running Code Connect publish

```bash
export FIGMA_ACCESS_TOKEN=figd_your_token_here
pnpm figma:publish
```

### Completing the wiring (required before first publish)

The `.figma.tsx` files have placeholder Figma URLs. Before publishing:

1. In Figma, select each component → right-click → **"Copy link to selection"**
2. Paste the URL into the `FIGMA_*_URL` constant in the corresponding file
3. Verify that the property name strings in `figma.enum()` / `figma.boolean()` / `figma.string()` match Figma's properties panel exactly

Full guide: [`docs/design/FIGMA_CODE_CONNECT.md`](./FIGMA_CODE_CONNECT.md)

---

## Component system

UI primitives live in `src/components/ui/` and use class-variance-authority (CVA) for variant management. All visual state is expressed through typed `variant` props — not raw CSS class names.

### Available components and variants

**Button** (`src/components/ui/button.tsx`)  
Variants: `default` | `primary` | `destructive` | `outline` | `secondary` | `tertiary` | `ghost` | `ghostOutline` | `link` | `card` | `cardSecondary` | `gradient`  
Sizes: `default` | `sm` | `lg` | `icon` | `custom` | `text`

**Badge** (`src/components/ui/badge.tsx`)  
Variants: `default` | `secondary` | `destructive` | `outline` | `success` | `warning` | `error`

**Card** (`src/components/ui/card.tsx`)  
Variants: `default` | `dark` | `outline` | `elevated` | `elevatedSubtle` | `regular` | `feedback` | `content` | `selectable`  
State modifiers (via className): `card-dark-error` | `card-dark-selected` | `card-outline-error` | `card-outline-selected`

**Modal overlays**: `ConfirmationModal`, `InfoModal`, `FormModal` — all use the same `modal-overlay` CSS class and `info-modal-container` shell.

### Styling rules

- Use the `variant` prop — not raw CSS class names like `card-dark` or `btn-card`
- Use semantic CSS tokens (`var(--surface-bg)`, `var(--control-border-focus)`) — not hardcoded hex values or raw Tailwind color classes like `bg-red-500`
- Apply `cn()` (clsx + tailwind-merge) for conditional class composition
- State modifiers (error, selected) are the exception — apply them via `className` on top of the variant

Token usage guide: [`docs/architecture/DESIGN_SYSTEM.md`](../architecture/DESIGN_SYSTEM.md)

---

## Typical iteration loop

### Changing a color or spacing value

1. Edit `src/themes/base.css` or `src/themes/theme.css`
2. Test visually in dev (`pnpm dev`)
3. Run `pnpm sync-tokens` to push to Figma Variables
4. Designer updates components in Figma to use the updated variable

### Adding a new component variant

1. Add the variant to the CVA definition in the component file
2. Add the corresponding token in `src/themes/theme.css` if needed
3. Add the new variant to the `.figma.tsx` prop mapping
4. Run `pnpm figma:publish`

### Implementing a design from Figma

1. Open the Figma frame in Dev Mode
2. Click a component — you'll see the JSX snippet with the correct props
3. Copy and use directly; imports are included in the snippet
