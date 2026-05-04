# GlassFlow Design Language

Research pass: Figma MCP (`O3yK9OEElDnnv4DLrfr9qc`, node `22009:26486`) + codebase token audit.
Use this as the source of truth before any design audit or component refactor.

---

## Color System

### Palette

| Role | CSS Token | Resolved Value |
|---|---|---|
| Page background | `--color-gray-dark-950` | `#0e0e10` |
| Navigation bg | `--color-black-500` | `#141414` |
| Card / container bg | `--color-gray-dark-800` | `#121214` |
| Elevated surface | `--color-gray-dark-900` | `#161617` |
| Input field bg | `--color-gray-750` | `#141414` |
| Input border (default) | `--color-gray-500` | `#373737` |
| Card border | `--color-gray-dark-300` | `#6c6c6c` |
| **Primary brand** | `--color-orange-300` | **`#ffa24b`** |
| Primary gradient start | `--color-orange-200` | `#feac5e` |
| Primary gradient end | `--color-orange-600` | `#e28024` |
| Primary text | `--color-foreground-neutral` | `#f1f2f6` |
| Secondary text | `--color-gray-250` | `#a8adb8` |
| Muted / placeholder text | `--color-foreground-neutral-faded` | `#a8adb8` |
| Step circle inactive | `--color-gray-dark-700` | `#1d1d26` |
| Step circle active | `--color-gray-dark-400` | `#6c7280` |
| Success | `--color-green-500` | `#00d370` |
| Error | `--color-red-500` | `#e22c2c` |
| Warning | `--color-yellow-500` | `#f59e0b` |
| Info / Blue | `--color-blue-500` | `#2495ff` |

### Background Elevation Hierarchy

```
#0e0e10  — page canvas
#141414  — navigation bar
#121214  — cards, wizard panels
#161617  — elevated surfaces, row hover
#141414  — input fields (same as nav — intentional)
```

### Primary Brand Gradient

Used on the primary CTA button and the navigation tab indicator:

```css
/* CTA button */
linear-gradient(151deg, #feac5e 18%, #e28024 76%)

/* Nav tab underline indicator */
linear-gradient(to right, rgba(226,128,36,0.3), #feac5e 50.5%, rgba(226,128,36,0.3))
```

---

## Typography

### Font Families

| Role | Family | Token |
|---|---|---|
| Headings, card labels | **Archivo** | `--font-family-title` |
| UI text, body, form fields | **Inter** | `--font-family-body` |

> **Note**: The Figma design files may show `Inter` for all text. The codebase intentionally uses `Archivo` for `--font-family-title` (headings and card labels) — this is the correct, decided split. Inter is the body/UI font. Both are loaded via `next/font` in `src/app/layout.tsx`.

### Type Scale

| Class | Size | Line Height | Weight | Font |
|---|---|---|---|---|
| `title-1` | 32px (2rem) | 52px | Bold (700) | Archivo |
| `title-2` | 28px (1.75rem) | 44px | Bold (700) | Archivo |
| `title-3` | 24px (1.5rem) | 36px | Medium (500) | Archivo |
| `title-4` | 20px (1.25rem) | 28px | Medium (500) | Archivo |
| `title-5` | 18px (1.125rem) | 24px | Bold (700) | Archivo |
| `title-6` | 16px (1rem) | 20px | Bold (700) | Archivo |
| `featured-1` | 32px | 40px | — | — |
| `featured-2` | 24px | 32px | — | — |
| `featured-3` | 20px | 28px | — | — |
| `body-1` | 18px (1.125rem) | 28px | Regular (400) | Inter |
| `body-2` | 16px (1rem) | 24px | Regular (400) | Inter |
| `body-3` | 14px (0.875rem) | 20px | Regular / Medium | Inter |
| `caption-1` | 12px (0.75rem) | 16px | Regular | Inter |
| `caption-2` | 10px (0.625rem) | 12px | Regular | Inter |

---

## Spacing & Radius

### Spacing Scale (base unit: 4px)

| Token | Value |
|---|---|
| `--unit-x1` | 4px |
| `--unit-x2` | 8px |
| `--unit-x3` | 12px |
| `--unit-x4` | 16px |
| `--unit-x5` | 20px |
| `--unit-x6` | 24px |
| `--unit-x8` | 32px |
| `--unit-x10` | 40px |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | 2px | — |
| `--radius-sm` | 4px | Input fields, small dropdowns |
| `--radius-md` | 8px | Buttons, select triggers |
| `--radius-xl` | 12px | Cards, wizard panels, modals |
| `--radius-3xl` | 22px | Step circles |
| `--radius-full` | 9999px | Chips, pills, toggle tracks |

---

## Component Anatomy

### Navigation Bar

- Height: 60px
- Background: `#141414`
- Bottom separator: `1px solid #3a3a3a`
- Active tab: orange underline gradient pill, white label text
- Inactive tab: `#b6bac3` label text
- Logo: GlassFlow lightning bolt + wordmark, left-aligned

### Left Step Rail (Pipeline Wizard)

- Vertical list of steps with 36px circular icon badges
- Thin connector lines between steps (SVG lines)
- **Active step badge**: `#6c7280` background, white icon, medium-weight label
- **Inactive step badge**: `#1d1d26` background, dimmed icon, secondary-color label (`#b6bac3`)
- Step labels: `body-3` / Inter Regular

### Primary CTA Button

```css
background: linear-gradient(151deg, #feac5e 18%, #e28024 76%);
border-radius: 8px;                      /* radius-md */
color: black;                            /* on-brand text */
font: 500 14px/20px Inter;               /* body-3 medium */
box-shadow: 0px 0px 4px rgba(0,0,0,0.2), 0px 4px 8px rgba(0,0,0,0.3);
padding: 8px 12px;
min-height: 36px;
```

### Input Fields

```css
background: #141414;                     /* gray-750 */
border: 1px solid #373737;              /* gray-500 */
border-radius: 4px;                      /* radius-sm */
height: 36px;
padding: 8px 12px;
font: 400 14px/20px Inter;
color: white;                            /* value text */
/* placeholder: #8a8f9a */
/* focus: border-color #ffa24b + 0 0 0 2px rgba(255,162,75,0.2) ring */
```

### Cards / Wizard Panels

```css
background: #121214;                     /* gray-dark-800 */
border: 1px solid #6c6c6c;
border-radius: 12px;                     /* radius-xl */
backdrop-filter: blur(10px);
box-shadow: 0px 0px 4px rgba(0,0,0,0.2), 0px 4px 8px rgba(0,0,0,0.2);
```

### Surface Gradient Border (modal signature detail)

The `.surface-gradient-border` utility applies a gradient border via `::before` pseudo-element with mask compositing — no extra markup required:

```css
.surface-gradient-border::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(180deg, #6c6c6c 0%, #23232d 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
```

Hover state transitions the border gradient to `#ffcda2` (warm orange glow).

---

## Design Aesthetic

**Tone**: Dark-mode-native, professional data infrastructure tool. The palette is near-monochromatic charcoal/black with a single warm amber-orange accent (`#ffa24b`) that communicates data-flow energy. The UI is dense but structured — built for a technical persona (data engineers) who value clarity over decoration.

**Key signature details to preserve in any audit:**
1. The orange gradient CTA — this is the primary brand moment on every step
2. The `surface-gradient-border` glow effect on modals
3. The subtle nav tab underline gradient (not a solid bar — it fades at the edges)
4. The elevation hierarchy — the page is darker than the cards, cards are darker than inputs are equal to nav (intentional depth signal)
5. The step rail connector lines — thin, low-contrast, intentionally recessive

---

## Figma Reference

| Item | Details |
|---|---|
| File key | `O3yK9OEElDnnv4DLrfr9qc` |
| Analyzed node | `22009:26486` (End-to-End Journey — pipeline wizard, Kafka connection step) |
| Design library file key | `sQIwmZ7augm8itFG6UDddV` |
| Primitives frame | node `65:1083` |
| Token sync command | `FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=sQIwmZ7augm8itFG6UDddV pnpm sync-tokens` |

---

## Token Source Files

| File | Purpose |
|---|---|
| `src/themes/base.css` | Raw color values (primitives) |
| `src/themes/theme.css` | Semantic token mappings (dark-only) |
| `src/app/styles/typography.css` | Typography utility classes |
| `src/app/styles/animations.css` | Animation utilities |
| `src/app/styles/layout.css` | Layout utilities |

---

## Animation System

All animation utilities live in `src/app/styles/animations.css`. Never write one-off `@keyframes` in component files — add to `animations.css` if genuinely new.

### Utility classes

| Class | Effect | Duration | Easing |
|---|---|---|---|
| `.animate-fadeIn` | Fade + slide up 10px | 200ms | ease-out |
| `.animate-slideDown` | Slide down 10px + fade | 200ms | ease-out |
| `.animate-slideDownFade` | Slide down 20px + right 10px + fade | 300ms | ease-out |
| `.animate-pulse` | Opacity 0.6 → 1 → 0.6, infinite | 1.5s | — |
| `.animate-slideUpFade` | Slide up 30px + fade | 300ms | ease-out |
| `.animate-feedback-entrance` | Fade + slide up 20px, fills forward | 500ms | ease-out |
| `.animate-fade-in-up` | Fade + slide up 20px, fills forward | 500ms | ease-out |
| `.animate-slideInFromRight` | Slide in from right 30px + fade | 300ms | ease-out |
| `.animate-expand-down` | Max-height 0 → 500px + fade | 300ms | cubic-bezier(0.4,0,0.2,1) |
| `.animate-collapse-up` | Max-height 500px → 0 + fade | 300ms | cubic-bezier(0.4,0,0.2,1) |
| `.animate-flow-dot` | Horizontal flow from left to right, infinite | 2.8s | linear |
| `.animate-column-rise` | ScaleY 0 → 1 + fade (for bar charts) | 550ms | spring cubic-bezier(0.34,1.56,0.64,1) |

### Delay modifiers

Compose with any animation utility:

```tsx
className="animate-fadeIn animate-delay-100"  // 100ms delay
className="animate-fadeIn animate-delay-200"  // 200ms delay
className="animate-fadeIn animate-delay-300"  // 300ms delay
className="animate-fadeIn animate-delay-400"  // 400ms delay
```

### Smooth expand / collapse

CSS transition-based alternative to keyframe animations — for accordions and collapsible sections:

```tsx
<div className={`smooth-expand ${isOpen ? 'expanded' : 'collapsed'}`}>
  {children}
</div>
```

`smooth-expand` transitions `max-height`, `opacity`, and `translateY` over 300ms `cubic-bezier(0.4,0,0.2,1)`.

### Motion tokens (from `base.css`)

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 200ms | Micro-interactions (hover, focus) |
| `--duration-medium` | 300ms | Component transitions |
| `--duration-slow` | 400ms | Page-level transitions |
| `--easing-standard` | `cubic-bezier(0.4,0,0.2,1)` | Default easing |
| `--easing-accelerate` | `cubic-bezier(0.4,0,1,1)` | Exit animations |
| `--easing-decelerate` | `cubic-bezier(0,0,0.2,1)` | Enter animations |

---

## Component Variant Reference

All visual state is expressed through typed `variant` props — never raw CSS class names in app code.

### Button (`src/components/ui/button.tsx`)

**Variants:** `default` | `primary` | `destructive` | `outline` | `secondary` | `tertiary` | `ghost` | `ghostOutline` | `link` | `card` | `cardSecondary` | `gradient`

**Sizes:** `default` | `sm` | `lg` | `icon` | `custom` | `text`

**Extra props:** `loading={bool}`, `loadingText="..."`, `asChild`

```tsx
<Button variant="gradient" size="default">Create Pipeline</Button>
<Button variant="ghost" size="sm" loading={isPending}>Save</Button>
```

> The `gradient` variant uses the primary brand gradient (`#feac5e` → `#e28024`). It is the primary CTA and the only button with a gradient background. Do not recreate it with `className`.

### Badge (`src/components/ui/badge.tsx`)

**Variants:** `default` | `secondary` | `destructive` | `outline` | `success` | `warning` | `error`

### Card (`src/components/ui/card.tsx`)

**Variants:** `default` | `dark` | `outline` | `elevated` | `elevatedSubtle` | `regular` | `feedback` | `content` | `selectable`

**State modifiers** (added via `className` on top of variant — the only valid exception to the variant-only rule):

| className modifier | Triggers |
|---|---|
| `card-dark-error` | Error border on `dark` variant |
| `card-dark-selected` | Selected highlight on `dark` variant |
| `card-outline-error` | Error border on `outline` variant |
| `card-outline-selected` | Selected highlight on `outline` variant |

### Internal CSS classes — do not use in app code

These are implementation details of UI primitives. Passing them from outside duplicates concerns and breaks variant encapsulation:

| Do not use directly | Use instead |
|---|---|
| `input-regular`, `input-border-regular`, `input-border-error` | `<Input error={bool}>` |
| `btn-card`, `btn-card-secondary` | `<Button variant="card">` / `<Button variant="cardSecondary">` |
| `card-dark`, `card-elevated`, `card-outline`, `card-regular` etc. | `<Card variant="dark">` etc. |
| `modal-input-label`, `modal-input-helper`, `modal-input-error` | `<FormItem>` + `<FormLabel>` + `<FormMessage>` |
| `btn-primary`, `btn-text` | `variant="primary"`, `size="text"` |

---

## Audit Checklist

When conducting a design audit, verify each component against these rules:

**Colors**
- [ ] No hardcoded hex values (`#rrggbb`) or `rgba()` in JSX or CSS
- [ ] No raw Tailwind color utilities (`bg-red-500`, `text-gray-400`, `border-zinc-*`)
- [ ] All colors resolved through `var(--*)` tokens

**Components**
- [ ] Visual state expressed via `variant` prop, not `className` styling
- [ ] `className` on components used for layout only (padding, margin, width, flex/grid)
- [ ] State modifiers (`card-dark-error`, etc.) only added via `className`, not by re-implementing styles

**Typography**
- [ ] Only `.title-*`, `.body-*`, `.caption-*`, `.featured-*` utility classes used (not arbitrary font sizes)
- [ ] Font family not overridden (Archivo for titles, Inter for body)

**Spacing**
- [ ] All spacing values are multiples of 4px or come from `--unit-x*` tokens

**Animations**
- [ ] Only `.animate-*` utilities from `animations.css` used
- [ ] No one-off `@keyframes` in component files
- [ ] `prefers-reduced-motion` respected (utilities use `ease-out`; no infinite animations in critical paths)
