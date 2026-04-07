# Figma Code Connect

Code Connect maps Figma components to React components so that developers see real, copy-pasteable JSX snippets in Figma's Dev Mode. It works alongside the token sync: tokens keep colors/spacing aligned, Code Connect keeps component usage aligned.

> **Plan requirement:** Code Connect requires a Figma Organization or Enterprise plan with a Dev or Full seat on the file.

---

## How it works

1. A `.figma.tsx` file colocated with the component declares the mapping.
2. `pnpm figma:publish` reads those files and uploads the mappings to Figma's API.
3. Developers opening the Figma file in Dev Mode see the exact JSX snippet for any component instance they click.

The `.figma.tsx` files are **never bundled** into the app — the CLI consumes them at publish time only. Check them into git so the mapping stays versioned alongside the component.

---

## File locations

| Code Connect file | Component it maps |
|---|---|
| `src/components/ui/button.figma.tsx` | `<Button>` — 12 variants, 4 sizes, loading + disabled |
| `src/components/ui/badge.figma.tsx` | `<Badge>` — 7 variants |
| `src/components/ui/card.figma.tsx` | `<Card>` — 9 variants |
| `src/components/common/modal.figma.tsx` | `<InfoModal>` and `<ConfirmationModal>` |

Global config: `figma.config.json` at the project root tells the CLI where to find `*.figma.tsx` files.

---

## One-time setup

### 1. Get a Figma personal access token

Figma → Account Settings → Personal access tokens → **Create new token**

Required scopes:
- `File content` — Read
- `Code Connect` — Write

Keep this token in your local environment (`.env.local` or shell profile). **Never commit it.**

### 2. Fill in the Figma component URLs

Each `.figma.tsx` file has a `FIGMA_*_URL` constant at the top that currently contains a placeholder. Replace each one:

1. Open your Figma design system file
2. Select the **main component** (not an instance) — e.g. the Button component set
3. Right-click → **"Copy link to selection"**
4. Paste the URL into the constant

```ts
// Before
const FIGMA_BUTTON_URL =
  'https://www.figma.com/design/REPLACE_FILE_ID/REPLACE_FILE_NAME?node-id=REPLACE_NODE_ID'

// After
const FIGMA_BUTTON_URL =
  'https://www.figma.com/design/n0LilXaAc6TuTn6g1qwOGz/Design-Library?node-id=123-456'
```

Files to update:

| File | URL constant |
|---|---|
| `src/components/ui/button.figma.tsx` | `FIGMA_BUTTON_URL` |
| `src/components/ui/badge.figma.tsx` | `FIGMA_BADGE_URL` |
| `src/components/ui/card.figma.tsx` | `FIGMA_CARD_URL` |
| `src/components/common/modal.figma.tsx` | `FIGMA_INFO_MODAL_URL` + `FIGMA_CONFIRMATION_MODAL_URL` |

### 3. Match Figma property names

The string keys inside `figma.enum()`, `figma.boolean()`, and `figma.string()` must **exactly match** the property names and option values shown in Figma's properties panel for that component.

Example — if your Button has a Figma property called `"Type"` (not `"Variant"`):

```ts
// Change this
variant: figma.enum('Variant', { Primary: 'primary', ... }),

// To this
variant: figma.enum('Type', { Primary: 'primary', ... }),
```

Check each component in Figma's right panel to verify property names before publishing.

---

## Publishing

```bash
# Set your token once per session (or add to .env.local)
export FIGMA_ACCESS_TOKEN=figd_your_token_here

# Publish all Code Connect files
pnpm figma:publish

# Remove all published connections (e.g. before a major rename)
pnpm figma:unpublish
```

Both scripts run `figma connect publish/unpublish` using the config in `figma.config.json`.

---

## Adding a new component

1. Create `src/components/ui/my-component.figma.tsx` next to the component file
2. Import `figma` from `'@figma/code-connect'`
3. Declare the URL constant (placeholder until you link it)
4. Call `figma.connect(MyComponent, URL, { props: {...}, example: (...) => <JSX/>, imports: [...] })`
5. Fill in the Figma URL and property names
6. Run `pnpm figma:publish`

Minimal template:

```tsx
import figma from '@figma/code-connect'
import { MyComponent } from '@/src/components/ui/my-component'

const FIGMA_URL = 'https://www.figma.com/design/REPLACE_FILE_ID/...?node-id=REPLACE_NODE_ID'

figma.connect(MyComponent, FIGMA_URL, {
  props: {
    variant: figma.enum('Variant', {
      Default: 'default',
      Primary: 'primary',
    }),
    label: figma.string('Label'),
    disabled: figma.boolean('Disabled'),
  },
  example: ({ variant, label, disabled }) => (
    <MyComponent variant={variant} disabled={disabled}>
      {label}
    </MyComponent>
  ),
  imports: ["import { MyComponent } from '@/src/components/ui/my-component'"],
})
```

---

## Available prop helpers

| Helper | Use for |
|---|---|
| `figma.enum('PropName', { FigmaOption: 'codeValue' })` | Variant/enum props |
| `figma.string('PropName')` | Text content, labels |
| `figma.boolean('PropName')` | Toggle props (disabled, loading, etc.) |
| `figma.instance('PropName')` | Nested Figma component instances |
| `figma.children()` | Unnamed child instances |
| `figma.nestedProps('LayerName', { ... })` | Properties of a nested layer |

---

## Troubleshooting

| Error | Fix |
|---|---|
| `403 Forbidden` | Token missing `Code Connect: Write` scope |
| `Component not found` | URL node-id doesn't match the main component — re-copy the link from Figma |
| Property name mismatch | Check the Figma properties panel — names are case-sensitive |
| `Organization plan required` | Code Connect requires Org or Enterprise; not available on Professional |

---

## Relationship to token sync

Token sync (`pnpm sync-tokens`) and Code Connect are independent but complementary:

| What | Script | Syncs |
|---|---|---|
| Token sync | `pnpm sync-tokens` | CSS variable values → Figma Variables |
| Code Connect | `pnpm figma:publish` | React component props → Figma Dev Mode snippets |

Run token sync when you change a color/spacing/radius value.
Run Code Connect publish when you add a new component or rename a prop.
