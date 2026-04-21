# GlassFlow ClickHouse ETL UI

Next.js 16 app. Package manager: **pnpm** — always use `pnpm`, never `npm`.

Full agent context is in `.cursor/` (rules) and `docs/` (canonical reference). This file is the Claude Code entry point; it mirrors those rules.

---

## UI & Styling — non-negotiable rules

### 1. Never hardcode colors

```tsx
// ✅
className="text-[var(--color-foreground-neutral-faded)]"
className="bg-[var(--surface-bg)] border border-[var(--surface-border)]"
style={{ backgroundColor: 'var(--overlay-bg)' }}

// ❌ — any of these break the token contract
style={{ color: '#A8ADB8' }}
className="bg-red-500 text-gray-400 border-gray-600"
style={{ backgroundColor: 'rgba(17, 25, 40, 0.25)' }}
```

No hardcoded hex values, rgba(), or raw Tailwind color utilities (`bg-red-*`, `text-gray-*`, `border-zinc-*`) for semantic or brand colors. Tailwind is allowed for layout/spacing/typography only.

### 2. Always use variant props — never raw CSS class names

```tsx
// ✅
<Button variant="primary" size="sm">Submit</Button>
<Card variant="dark" className="p-4 mt-6">...</Card>
<Badge variant="success">{status}</Badge>

// ❌
<button className="btn-primary">Submit</button>
<div className="card-dark p-4 mt-6">...</div>
<span className="bg-green-600 text-white px-2">active</span>
```

`className` on component wrappers is for **layout only** (padding, margin, width, flex/grid). Visual state lives in `variant`.

### 3. Component token reference

**Button** (`src/components/ui/button.tsx`)
- Variants: `default` | `primary` | `destructive` | `outline` | `secondary` | `tertiary` | `ghost` | `ghostOutline` | `link` | `card` | `cardSecondary` | `gradient`
- Sizes: `default` | `sm` | `lg` | `icon` | `custom` | `text`
- Extra props: `loading={bool}` (shows spinner, disables), `loadingText="..."`, `asChild`

**Badge** (`src/components/ui/badge.tsx`)
- Variants: `default` | `secondary` | `destructive` | `outline` | `success` | `warning` | `error`

**Card** (`src/components/ui/card.tsx`)
- Variants: `default` | `dark` | `outline` | `elevated` | `elevatedSubtle` | `regular` | `feedback` | `content` | `selectable`
- State modifiers (add via `className` on top of variant): `card-dark-error`, `card-dark-selected`, `card-outline-error`, `card-outline-selected`

### 4. Do not use these in app code

These CSS classes are **internal** to their primitives — passing them from outside duplicates concerns:

| Don't use directly | Use instead |
|---|---|
| `input-regular`, `input-border-regular`, `input-border-error` | `<Input error={bool}>` — primitive applies these |
| `btn-card`, `btn-card-secondary` | `<Button variant="card">` / `<Button variant="cardSecondary">` |
| `card-dark`, `card-elevated`, `card-outline` etc. as className | `<Card variant="dark">` etc. |
| `modal-input-label`, `modal-input-helper`, `modal-input-error` | `<FormItem>` + `<FormLabel>` + `<FormMessage>` |
| `btn-primary`, `btn-text` | `variant="primary"`, `size="text"` |

### 5. Modal pattern

All modals use the same shell — be consistent:

```tsx
<DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
<DialogContent className="info-modal-container surface-gradient-border border-0">
  <DialogTitle className="modal-title ...">...</DialogTitle>
  <DialogDescription className="modal-description ...">...</DialogDescription>
</DialogContent>
```

Never use inline `style={}` on `DialogOverlay`. The `--overlay-bg`, `--overlay-backdrop-blur`, `--overlay-border` tokens are applied by the `modal-overlay` CSS class.

### 6. Form controls

Use `--control-*` tokens for any form element not served by a primitive:

```tsx
// focus ring
className="focus:shadow-[var(--control-shadow-focus)] focus:border-[var(--control-border-focus)]"

// placeholder
className="placeholder:text-[var(--control-fg-placeholder)]"
```

Pass `error={bool}` to `<Input>`, `<Select>`, `<Textarea>` — they handle `--control-border-error` internally.

### 7. Adding new tokens

If no existing token fits, add one — don't invent inline values:

1. Add the base value to `src/themes/base.css` (primitives `:root`)
2. Add the semantic reference to `src/themes/theme.css` (`:root, [data-theme='dark']` block)
3. Use `var(--your-new-token)` in the component
4. Run `pnpm sync-tokens` to push to Figma Variables

Never invent one-off values in a component file.

### 8. Typography

Use the typography utility classes from `src/app/styles/typography.css`:

```tsx
// ✅
<h1 className="title-1">...</h1>
<p className="body-2 text-[var(--text-secondary)]">...</p>
<span className="caption-1">...</span>

// Font families via tokens
// --font-family-title: Archivo (headings, card labels)
// --font-family-body:  Inter  (UI text, form fields, body copy)
```

Scale: `title-1` → `title-6`, `body-1` → `body-3`, `caption-1` → `caption-2`, `featured-1` → `featured-3`.

### 9. Animations

Use the utilities from `src/app/styles/animations.css`:

```tsx
className="animate-fadeIn animate-delay-100"
className="animate-slideDown"
className="smooth-expand expanded"
```

Don't write one-off `@keyframes` in component files. Add to `animations.css` if genuinely new.

### 10. Dark theme — always

The app is dark-only. `ThemeProvider` sets `defaultTheme="dark"` with `enableSystem=false`. Never add light-theme branches or conditionally apply light color values.

---

## Component hierarchy

```
src/components/ui/        ← shadcn/Radix primitives; own all visual state
src/components/common/    ← reusable domain-neutral patterns (2+ use sites)
src/components/shared/    ← app-wide layout, providers, header/footer
src/modules/*/components/ ← feature-specific components with domain logic
```

- `ui/` components: only extend for token alignment, never break Radix behavior
- `common/` and `shared/`: consume primitives via semantic props; `className` for layout only
- New reusable patterns → `common/` before adding to a module

---

## State management

- Zustand with slice pattern: `createXxxSlice: StateCreator<XxxSlice>`, composed in `src/store/index.ts`
- Access via `const { xStore } = useStore()`
- Hydration always through `coreStore.hydrateFromConfig(config)` or `hydrateSection(section, config)` — never write slices directly from raw backend data
- Pipeline wizard requires `coreStore.setTopicCount(n)` before rendering — called from home page (`/`)

---

## Forms

Schema-first with Zod. Manager/Renderer split:
- Manager owns `useForm`, submit logic, validation schema
- Renderer receives `control` and renders fields
- Use `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` from `src/components/ui/form`
- Never manage error display manually when FormMessage covers it

---

## General TypeScript rules

- `strict: true` — no `any`; infer types from Zod schemas
- `'use client'` only when hooks or DOM APIs are required
- Prefer server components by default (Next.js App Router)
- External libs first, then internal aliases (`@/src/...`), then relative imports

---

## Figma workflow

Token sync and Code Connect are the two layers:

```bash
# Push CSS token values → Figma Variables
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=sQIwmZ7augm8itFG6UDddV pnpm sync-tokens

# Push component prop mappings → Figma Dev Mode snippets
FIGMA_ACCESS_TOKEN=... pnpm figma:publish
```

Design library: file key `sQIwmZ7augm8itFG6UDddV`, primitives frame node `65:1083`.
Code Connect files: `src/components/ui/*.figma.tsx` and `src/components/common/modal.figma.tsx`.

Run token sync when changing colors/spacing/radius. Run Code Connect publish when adding or renaming a component variant.

---

## Key references

| Topic | File |
|---|---|
| Full token system, card variants, usage patterns | `docs/architecture/DESIGN_SYSTEM.md` |
| Token → Figma variable mapping table | `docs/design/FIGMA_TOKEN_REFERENCE.md` |
| Figma workflow (token sync + Code Connect) | `docs/design/DESIGN_WORKFLOW.md` |
| Code Connect setup and publish guide | `docs/design/FIGMA_CODE_CONNECT.md` |
| Component architecture | `.cursor/architecture/COMPONENT_ARCHITECTURE.md` |
| State management | `.cursor/architecture/STATE_MANAGEMENT.md` |
| Form architecture | `.cursor/architecture/FORM_ARCHITECTURE.md` |
| API architecture | `.cursor/architecture/API_ARCHITECTURE.md` |
| Theming architecture | `.cursor/architecture/THEMING_ARCHITECTURE.md` |
| Cursor rules (styling, components, forms, API) | `.cursor/styling.mdc`, `.cursor/components.mdc`, etc. |
