# Component Gallery

A live, in-app reference for every UI primitive and pattern in the GlassFlow design system. Runs at `/dev/components` in any local or development environment.

---

## Purpose

- Verify that the design system's token contract is working correctly (every preview uses only `var(--*)` tokens)
- Provide copy-paste usage snippets for each component variant and state
- Serve as a visual regression check when changing tokens or component styles
- Onboard contributors to available components before they start writing UI code

---

## URL structure

| Route | Content |
|---|---|
| `/dev/components` | Overview grid — all categories at a glance |
| `/dev/components/foundations` | Typography scale, semantic colors, surface tokens, spacing, border radius |
| `/dev/components/buttons` | All 11 Button variants, 6 sizes, icon combos, loading and disabled states |
| `/dev/components/display` | All Card variants + state modifiers, Badge variants, Avatar, Table |
| `/dev/components/forms` | Input, Textarea, Select, Checkbox, Switch, Label, control token reference |
| `/dev/components/overlays` | Dialog (info / confirmation / form patterns), Tooltip, Popover, Dropdown Menu |
| `/dev/components/navigation` | Tabs (default + with badges), Accordion (single + multiple) |
| `/dev/components/feedback` | Alert variants, Sonner toast types, animation utility classes, chip states |

---

## File structure

```
src/app/dev/components/
├── layout.tsx               # Sidebar layout — server component
├── page.tsx                 # Overview landing page — server component
├── GalleryNav.tsx           # Sidebar navigation — client component (needs usePathname)
├── _components/
│   └── Section.tsx          # Shared primitives: Section, VariantGrid, Preview, CodeBlock, PageHeader
├── foundations/page.tsx
├── buttons/page.tsx
├── display/page.tsx
├── forms/page.tsx
├── overlays/page.tsx
├── navigation/page.tsx
└── feedback/page.tsx
```

The `_components/` prefix marks it as a private folder — Next.js App Router does not create a route for it.

Each section page is a `'use client'` component because the demos require interactivity (dialogs open, switches toggle, animations play). The layout and overview page remain server components.

---

## Shared primitives (`_components/Section.tsx`)

| Export | Purpose |
|---|---|
| `<PageHeader title description>` | Section-level h1 + description |
| `<Section title description>` | Bordered subsection container with heading |
| `<VariantGrid columns={2\|3\|4\|5\|6}>` | Responsive grid for variant previews |
| `<Preview label center>` | Single component demo box with optional label |
| `<CodeBlock code>` | Monospace code display for usage snippets |

---

## Adding a new section

1. Create `src/app/dev/components/<section-name>/page.tsx`
2. Mark it `'use client'` if the demos need interactivity
3. Import primitives from `../_components/Section`
4. Add an entry to `GalleryNav.tsx` (the `sections` array)
5. Add an entry to the overview cards in `page.tsx`

```tsx
// Minimal section page template
'use client'
import { Section, PageHeader, Preview, CodeBlock } from '../_components/Section'

export default function MySection() {
  return (
    <div>
      <PageHeader title="My Component" description="Brief description." />
      <Section title="Variants">
        <Preview label="default">
          <MyComponent />
        </Preview>
        <CodeBlock code={`<MyComponent />`} />
      </Section>
    </div>
  )
}
```

---

## Token contract

Every element in the gallery uses the design system tokens — no hardcoded hex values. This is intentional: the gallery acts as a live contract test. If a token is broken or misconfigured, it will be immediately visible.

Key tokens used throughout:

| Token | Used for |
|---|---|
| `var(--surface-bg-sunken)` | Preview container background |
| `var(--surface-border)` | Preview container and section borders |
| `var(--text-primary)` | Primary text |
| `var(--text-secondary)` | Labels, descriptions, monospace hints |
| `var(--color-foreground-primary)` | Active nav indicator, code label accent |
| `var(--color-background-primary-faded)` | Active nav background, accent swatches |

Full token reference: [`docs/design/FIGMA_TOKEN_REFERENCE.md`](../design/FIGMA_TOKEN_REFERENCE.md)  
Design system architecture: [`docs/architecture/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)

---

## When to update the gallery

- **New component added** → add a `<Preview>` for each variant in the relevant section page
- **New variant added to an existing component** → add it to the section for that component
- **Token renamed or added** → update the Foundations page (`foundations/page.tsx`) token tables
- **New animation added** → add it to the Feedback page (`feedback/page.tsx`) animations grid
- **New chip state added** → add it to the Feedback page chip states section
