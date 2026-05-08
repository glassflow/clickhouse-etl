# Component Gallery — Design System Audit

> Audit performed: 2026-05-08 | Branch: `ui-ux-revamp-2.0`
>
> **Scope:** All pages under `src/app/(main)/dev/components/**` cross-referenced against
> `src/themes/base.css`, `src/themes/theme.css`, `src/app/globals.css`,
> and all files under `src/app/styles/**`.
>
> **Previous gap doc:** `docs/DESIGN_SYSTEM_GAPS.md` (from an earlier sprint — most items there
> have been resolved and are now in the Utilities and Drawers sections of the gallery).

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | Mostly solid; `KbdHint` is `aria-hidden` by design; `text-brand-gradient` is purely decorative |
| 2 | Performance | 3/4 | Animations use `transform/opacity`; `smooth-expand` transitions `max-height` (layout property) |
| 3 | Responsive Design | 3/4 | Gallery is responsive; component docs lack mobile touch-target guidance |
| 4 | Theming | 2/4 | ~40% of tokens in `theme.css` have no gallery representation; hardcoded px in `modal.css`; two button variants bypass GlassFlow tokens |
| 5 | Anti-Patterns | 2/4 | `text-brand-gradient` (gradient text = absolute ban); raw `card-dark` className on gallery index |
| **Total** | | **13/20** | **Acceptable — significant documentation and token compliance work needed** |

---

## Anti-Patterns Verdict

Two explicit violations of the project's design principles are **codified in the gallery itself**,
which means developers reading the gallery as the source of truth will learn the wrong pattern.

### 1. `text-brand-gradient` is gradient text — an absolute-banned pattern

**File:** `src/app/styles/typography.css:95–100`
**Gallery:** `foundations/page.tsx:27` — listed as an official "Utility Typography" class

The implementation uses `background-clip: text` + `-webkit-text-fill-color: transparent` on a
`linear-gradient` background. This is in the absolute-bans list (gradient text is one of the top
three "AI slop" tells). The gallery presents it alongside `text-content`, `text-normal-accent`,
and `text-accent` as if it's equivalent — it is not.

### 2. Raw `card-dark` CSS class used on gallery index page

**File:** `src/app/(main)/dev/components/page.tsx:82`

```tsx
// ❌ Current — violates CLAUDE.md §4
<Link className="group card-dark p-5 rounded-xl flex flex-col gap-3 ...">

// ✅ Correct
<Card variant="dark" className="group p-5 rounded-xl flex flex-col gap-3 ...">
```

CLAUDE.md §4 explicitly states `card-dark` is internal to the Card primitive.
The gallery index page — the first thing a developer sees — teaches the wrong pattern.

---

## Findings by Severity

### P0 — Blocking (silent runtime failure)

#### [P0] Broken token: `--line-height-featured-4` does not exist

| | |
|---|---|
| **File** | `src/app/styles/typography.css:155` |
| **Class** | `.subtitle-2` |
| **Impact** | CSS silently falls back to `line-height: normal`. The class has been broken for an unknown duration with no error. |
| **Root cause** | `featured-4` was never defined in `base.css`. The featured scale stops at `featured-3`. |
| **Fix** | Replace `var(--line-height-featured-4)` with `var(--line-height-title-5)` — `subtitle-2` already uses `--font-size-title-5`, so this is the consistent line-height. |

---

### P1 — Major (fix before building new features against the gallery)

#### [P1-A] `text-brand-gradient` documented as official — must be removed from gallery

| | |
|---|---|
| **Files** | `src/app/styles/typography.css:95–100`, `foundations/page.tsx:27` |
| **Impact** | Developers treating the gallery as source of truth will use gradient text in product UI. |
| **Fix** | Remove the entry from the Utility Typography table in `foundations/page.tsx`. In `typography.css`, keep the class but prefix with a comment marking it internal-only (used solely in one-off hero contexts, not for general product UI). |

#### [P1-B] Gallery index page uses raw `card-dark` CSS class

| | |
|---|---|
| **File** | `src/app/(main)/dev/components/page.tsx:82` |
| **Impact** | The very first page of the gallery models the wrong pattern. |
| **Fix** | Replace with `<Card variant="dark">` wrapping the Link element (or use `asChild` pattern). |

#### [P1-C] Three card variants completely missing: `default`, `regular`, `selectable`

| | |
|---|---|
| **CLAUDE.md says** | Variants: `default \| dark \| outline \| elevated \| elevatedSubtle \| regular \| feedback \| content \| selectable` |
| **Gallery shows** | `dark`, `outline`, `elevated`, `feedback`, `content`, `elevatedSubtle` |
| **Missing** | `default` (bare card bg + surface border), `regular` (warm brown gradient border, elevated bg), `selectable` (maps to `btn-card` CSS — card-button style for selection UIs) |
| **File** | `src/app/styles/components/card.css` has all three; `card.tsx:6–21` has all mappings |

#### [P1-D] `card-outline-error` and `card-outline-selected` state modifiers not shown

| | |
|---|---|
| **CLAUDE.md says** | State modifiers: `card-dark-error`, `card-dark-selected`, `card-outline-error`, `card-outline-selected` |
| **Gallery shows** | Only `card-dark-selected` and `card-dark-error` |
| **File** | `card.css:69–77` — both outline modifiers exist and are fully implemented |
| **Impact** | Any `outline` card in an error or selected state will be implemented ad hoc |

#### [P1-E] Button `outline` variant missing from gallery; uses shadcn tokens not GlassFlow tokens

| | |
|---|---|
| **File** | `button.tsx:20–21` — variant exists; `buttons/page.tsx` — not shown |
| **Token issue** | `outline` variant uses `border-input bg-background hover:bg-accent hover:text-accent-foreground` (raw shadcn aliases) instead of explicit GlassFlow `--button-*` or `--surface-*` tokens |
| **Impact** | Undocumented variant that also has a token compliance problem |

#### [P1-F] `mono-*` typography scale invisible in gallery

| | |
|---|---|
| **File** | `src/app/styles/typography.css:169–190` — `.mono-1`, `.mono-2`, `.mono-3` defined |
| **Gallery** | No Mono section anywhere in Foundations |
| **Impact** | Developers fall back to raw Tailwind `font-mono` which uses the browser's default monospace stack, not `--font-family-mono` (JetBrains Mono). Used for IDs, timestamps, axis labels, code snippets. |

#### [P1-G] `caption-*` scale missing from gallery

| | |
|---|---|
| **File** | `typography.css:135–148` — `.caption-1`, `.caption-2` defined |
| **Gallery** | Foundations shows Title Scale, Body Scale, Utility Typography — but no Caption Scale |
| **Impact** | Developers reach for `text-xs` Tailwind utility, bypassing the font-family and line-height tokens |

#### [P1-H] `featured-*` scale — tokens defined but no utility classes exist

| | |
|---|---|
| **Tokens** | `base.css:45–55` — `--font-size-featured-1/2/3`, `--line-height-featured-1/2/3` |
| **Classes** | None. Zero `.featured-*` utility classes in `typography.css`. |
| **Real-world usage** | `modal.css:64` reaches directly for `var(--font-size-featured-2)` — skipping the utility layer entirely |
| **Impact** | Every component needing "featured" sizing does it differently. No consistent abstraction. |
| **Fix** | Add `.featured-1`, `.featured-2`, `.featured-3` classes to `typography.css` modeled after the existing title/body classes |

#### [P1-I] 4 text tokens not documented in gallery

| | |
|---|---|
| **Gallery shows** | `--text-primary`, `--text-secondary`, `--text-accent`, `--text-link`, `--text-error`, `--text-success`, `--text-warning` (7 tokens) |
| **Also defined in theme.css** | `--text-heading`, `--text-inverse`, `--text-link-hover`, `--text-disabled` |
| **Impact** | `--text-inverse` (black — for text on orange CTA buttons) and `--text-disabled` go unused; developers use `--text-secondary` where `--text-disabled` is semantically correct |

#### [P1-J] Hardcoded pixel values in `modal.css`

| Line | Current | Should be |
|---|---|---|
| `76` | `font-size: 16px` | `var(--font-size-body-2)` |
| `77` | `line-height: 1.5` | `var(--line-height-body-2)` |
| `224` | `font-size: 24px` | `var(--font-size-featured-2)` |
| `230` | `font-size: 16px` | `var(--font-size-body-2)` |
| `231` | `line-height: 1.2` | `var(--line-height-featured-2)` |

These values in `.modal-description`, `.step-title`, `.step-description` will not update when
the type scale changes in `base.css`.

---

### P2 — Minor (fix in next pass)

#### [P2-A] 5 surface tokens not in gallery Surface Tokens section

The gallery shows 4 surface tokens (`--surface-bg`, `--surface-bg-raised`, `--surface-bg-overlay`,
`--surface-bg-sunken`). Also defined in `theme.css`:

| Token | Purpose |
|---|---|
| `--surface-border` | Primary container border (used everywhere) |
| `--surface-border-subtle` | Lower-contrast border for nested containers |
| `--surface-fg` | Surface foreground text |
| `--surface-fg-muted` | Muted surface foreground |
| `--surface-shadow` | Standard container shadow |
| `--surface-shadow-overlay` | Elevated overlay shadow |

#### [P2-B] `--option-*` token system completely undocumented

`theme.css:199–212` defines a full option token system for hover/selected/highlighted states on
list items and dropdown options. Zero gallery representation.

| Token | Value |
|---|---|
| `--option-bg` | `transparent` |
| `--option-bg-hover` | orange alpha 10% |
| `--option-bg-selected` | orange alpha 15% |
| `--option-bg-highlighted` | orange alpha 20% |
| `--option-fg-selected` | primary brand color |
| `--option-fg-disabled` | disabled foreground |

Any custom dropdown, combobox, or list will implement hover/selected states ad hoc without this.

#### [P2-C] Shadow and z-index token subsystems not in gallery

**Shadows** (`base.css:273–276`):
`--shadow-raised`, `--shadow-overlay`, `--shadow-pressed`, `--shadow-neutral`

**Z-index** (`base.css:279–284`):
`--z-index-dropdown` (1000) through `--z-index-tooltip` (1060)

#### [P2-D] 8+ animation classes not shown in gallery

The Feedback page animations section shows 7 classes. `animations.css` defines:

| Class | Shown |
|---|---|
| `animate-fadeInOpacity` | ❌ |
| `animate-section-enter` | ❌ |
| `animate-flow-dot` | ❌ |
| `animate-column-rise` | ❌ |
| `animate-expand-down` | ❌ |
| `animate-collapse-up` | ❌ |
| `animate-fadeOut` | ❌ |
| `animate-drawerSlideInRight/Out/Left/LeftOut` | ❌ |
| `animate-skeletonShimmer` | ❌ (internal to Skeleton) |
| `animate-livePulse` | ❌ (internal to LiveIndicator) |
| `smooth-expand` + `.expanded/.collapsed` | ❌ (code snippet only, not visually demonstrated) |

#### [P2-E] `ghost` button variant uses raw shadcn tokens

`button.tsx:26`: `hover:bg-accent hover:text-accent-foreground`

`bg-accent` resolves correctly through the shadcn → GlassFlow alias chain (`--accent` → `--color-background-primary-faded`), but it's fragile and inconsistent with all other variants that use explicit `--button-*` tokens. If the `--accent` alias ever changes for a different reason, ghost hover behavior changes silently.

#### [P2-F] Button size `custom` not shown in gallery

`button.tsx:40` — `custom` size exists (`min-w-9 min-h-9 px-3 py-2 gap-2`). Not demonstrated.

#### [P2-G] 5 UI components with no gallery entry

| Component | File | Tests |
|---|---|---|
| `InputGroup` | `input-group.tsx` | — |
| `TimeRangePicker` | `time-range-picker.tsx` | ✅ |
| `Calendar` | `calendar.tsx` | — |
| `Command` | `command.tsx` | — |
| `Sheet` | `sheet.tsx` | — |

`Sheet` is particularly relevant — it's a Radix-based side panel and may overlap with or replace
`Drawer` in some contexts. The distinction is not documented anywhere.

---

### P3 — Polish (fix if time permits)

#### [P3-A] Dashboard and Observability token subsystems undocumented

`theme.css` defines two subsystem-specific token groups with no gallery representation:

**Dashboard** (`--dash-page-bg`, `--dash-card-bg`, `--dash-subdued-bg`, `--dash-element-bg`, `--dash-row-hover`)

**Observability** — 14 tokens for chart series colors, severity colors (debug/info/warn/error/fatal),
retention bar tones, drift indicators, and the live indicator pulse color.

These are fine to omit from the general gallery — but should be documented in the module-level
docs for `/dashboard` and `/observability`.

#### [P3-B] `smooth-expand` uses `max-height` (layout property — triggers reflow)

`animations.css:224–237` transitions `max-height: 0 → 600px`. This triggers layout recalculation
on every animation frame. The correct technique for accordion-style expand/collapse is:

```css
/* ✅ Correct — only triggers composite, no layout */
.smooth-expand {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease-in-out;
}
.smooth-expand.expanded {
  grid-template-rows: 1fr;
}
.smooth-expand > * { overflow: hidden; }
```

#### [P3-C] Toggle/Switch detailed tokens not surfaced

The Switch section in `forms/page.tsx` demonstrates component usage but doesn't expose the
underlying `--toggle-track-checked-bg`, `--toggle-track-unchecked-bg`, `--toggle-thumb-*` tokens.
Custom toggle-like components will be built without this reference.

#### [P3-D] Table token subsystem not surfaced

The Table section shows component usage but not the 6 table-specific tokens:
`--table-header-bg`, `--table-row-bg`, `--table-row-bg-hover`, `--table-body-bg`,
`--table-fg`, `--table-fg-muted`.

---

## Positive Findings — What's Working Well

These are the parts of the gallery that are done right and should be used as the model for additions.

- **Form controls section** — Exemplary. Shows all states (default, disabled, readonly, error), includes the control token reference table, and gives copyable code patterns.
- **Overlay/modal shell pattern** — The most thoroughly documented section. Canonical `DialogOverlay` + `modal-overlay` + `info-modal-container` pattern is explicit, with working interactive examples and inline rules.
- **Drawers & Modals section** — All four patterns covered (Drawer, ConfirmationModal, InfoModal, raw Dialog shell). Interactive state management demonstrated with result feedback.
- **Animation system** — Uses correct easing (`ease-out-quart`, `ease-out-expo`) everywhere. `prefers-reduced-motion` support kills all animations at system level in `animations.css:294–305`.
- **Pill component accessibility** — Renders as `<button aria-pressed>` when interactive, `<span>` when static. Not documented explicitly in the gallery but is solid in the implementation.
- **Code examples throughout** — Every section has copyable code blocks that follow the CLAUDE.md rules. This is the gallery's greatest strength.

---

## Recommended Actions — Priority Order

Work through these in sequence. Each action refers to specific files and locations.

---

### Action 1 — Fix broken token [P0]

**File:** `src/app/styles/typography.css:155`

```css
/* Current — broken (--line-height-featured-4 doesn't exist) */
.subtitle-2 {
  line-height: var(--line-height-featured-4);  /* ❌ */
}

/* Fix */
.subtitle-2 {
  line-height: var(--line-height-title-5);     /* ✅ matches --font-size-title-5 used above */
}
```

---

### Action 2 — Remove gradient text from gallery; annotate as internal [P1-A]

**File 1:** `foundations/page.tsx:27` — remove the `text-brand-gradient` entry from `utilityItems`
**File 2:** `typography.css:94` — add a comment:

```css
/* INTERNAL — used only in one-off hero/marketing contexts.
   Do not use in product UI. See CLAUDE.md §1. */
.text-brand-gradient { ... }
```

---

### Action 3 — Fix gallery index: use `<Card>` not raw `card-dark` className [P1-B]

**File:** `src/app/(main)/dev/components/page.tsx:79–83`

The `<Link>` element needs to become a `<Card>` or the `card-dark` style needs to be applied
via the proper primitive. Since `Link` needs to be the interactive element, use `asChild`:

```tsx
<Card variant="dark" asChild className="group p-5 rounded-xl ...">
  <Link href={href}>
    ...
  </Link>
</Card>
```

---

### Action 4 — Add `featured-*` utility classes to typography.css [P1-H]

**File:** `src/app/styles/typography.css`

Add after the existing title classes:

```css
/* ================== Featured ================== */
.featured-1 {
  font-size: var(--font-size-featured-1);
  line-height: var(--line-height-featured-1);
  font-family: var(--font-family-title);
  letter-spacing: var(--letter-spacing-featured-1);
}

.featured-2 {
  font-size: var(--font-size-featured-2);
  line-height: var(--line-height-featured-2);
  font-family: var(--font-family-title);
  letter-spacing: var(--letter-spacing-featured-2);
}

.featured-3 {
  font-size: var(--font-size-featured-3);
  line-height: var(--line-height-featured-3);
  font-family: var(--font-family-title);
  letter-spacing: var(--letter-spacing-featured-3);
}
```

Then update `modal.css:60–63` to use `.featured-2` (or keep the raw token — it still resolves
correctly, but the utility class is the preferred pattern going forward).

---

### Action 5 — Add Mono Scale and Caption Scale sections to Foundations gallery [P1-F, P1-G]

**File:** `foundations/page.tsx`

Add two new `<Section>` blocks:

**Mono Scale** (after Body Scale, before Utility Typography):
Show `.mono-1`, `.mono-2`, `.mono-3` with sample content like `2026-05-08T14:32:01Z`,
`etl-prod-kafka-abc123`, and `SELECT * FROM events LIMIT 100`.

**Caption Scale** (after Body Scale):
Show `.caption-1` and `.caption-2` with sample label/tag content.

---

### Action 6 — Add Featured Scale section to Foundations gallery [P1-H]

**File:** `foundations/page.tsx`

Add a "Featured Scale" section (between Title and Body scales) showing all three featured classes.
Featured is used for modal titles, hero numbers, and prominent callout text.

---

### Action 7 — Extend Card Variants section [P1-C, P1-D]

**File:** `display/page.tsx`

Add a third row to the card grid showing:
- `variant="default"` — bare card with surface bg and border
- `variant="regular"` — elevated bg with warm brown gradient border
- `variant="selectable"` — card-button style (note: maps to `btn-card` CSS)

Extend the state modifiers section:
- `card-outline-error` on a `variant="outline"` card
- `card-outline-selected` on a `variant="outline"` card

---

### Action 8 — Add `outline` and `custom` to Buttons gallery [P1-E, P2-F]

**File:** `buttons/page.tsx`

- Add `outline` variant to the Variants section with a note about its current shadcn token usage
- Add `custom` size to the Sizes section with an example showing its use case (flexible-width buttons)

---

### Action 9 — Fix `modal.css` hardcoded pixel values [P1-J]

**File:** `src/app/styles/components/modal.css`

| Line | Replace | With |
|---|---|---|
| 76 | `font-size: 16px` | `font-size: var(--font-size-body-2)` |
| 77 | `line-height: 1.5` | `line-height: var(--line-height-body-2)` |
| 224 | `font-size: 24px` | `font-size: var(--font-size-featured-2)` |
| 230 | `font-size: 16px` | `font-size: var(--font-size-body-2)` |
| 231 | `line-height: 1.2` | `line-height: var(--line-height-featured-2)` |

---

### Action 10 — Extend Text Tokens section in gallery [P1-I]

**File:** `foundations/page.tsx:48–56`

Add the 4 missing tokens to the `textTokens` array:

```ts
{ token: '--text-heading', label: 'text-heading' },
{ token: '--text-inverse', label: 'text-inverse' },
{ token: '--text-link-hover', label: 'text-link-hover' },
{ token: '--text-disabled', label: 'text-disabled' },
```

---

### Action 11 — Add missing token sections to Foundations gallery [P2-A, P2-B, P2-C]

**File:** `foundations/page.tsx`

Add three new `<Section>` blocks after the existing Text Tokens section:

**Surface Tokens (complete)** — add the 6 currently missing surface tokens alongside the 4 shown

**Option Tokens** — show the 6 `--option-*` tokens as interactive swatches with hover simulation

**Shadow Tokens** — show `--shadow-raised`, `--shadow-overlay`, `--shadow-pressed`, `--shadow-neutral`
as visual shadow examples on small cards

Z-index tokens are table data, not visual — add them as a simple reference table.

---

### Action 12 — Complete animations gallery [P2-D]

**File:** `feedback/page.tsx`

Add the missing animation entries to the animation grid:
`animate-fadeInOpacity`, `animate-section-enter`, `animate-flow-dot`, `animate-column-rise`,
`animate-expand-down` / `animate-collapse-up`, `animate-fadeOut`.

Add a live visual demo for `smooth-expand` (not just the code snippet).

Note: `animate-skeletonShimmer` and `animate-livePulse` are internal to their respective
components — they don't need gallery entries but should be noted as such.

---

### Action 13 — Add gallery entries for undocumented components [P2-G]

**New or extended page:** Utilities section or a new "Advanced" section

| Component | What to show |
|---|---|
| `InputGroup` | Grouped input with prefix/suffix |
| `TimeRangePicker` | Preset list + custom range mode |
| `Calendar` | Date-range selection |
| `Command` | Search palette pattern |
| `Sheet` | Distinction from Drawer: when to use each |

---

### Action 14 — Fix `smooth-expand` performance [P3-B]

**File:** `src/app/styles/animations.css:222–238`

Replace the `max-height` transition with `grid-template-rows`:

```css
.smooth-expand {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease-in-out,
              opacity 0.2s ease-in-out;
  overflow: hidden;
}
.smooth-expand > * { overflow: hidden; }

.smooth-expand.collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.smooth-expand.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}
```

Note: this changes the DOM requirement — the immediate child of `.smooth-expand` must be a
single wrapper element. Audit all usages before applying.

---

## Summary Table

| Priority | Action | Files | Impact |
|---|---|---|---|
| **P0** | Fix `--line-height-featured-4` broken token | `typography.css:155` | Silent CSS failure |
| **P1** | Remove gradient text from gallery | `foundations/page.tsx`, `typography.css` | Anti-pattern propagation |
| **P1** | Fix gallery index: `<Card>` not raw `card-dark` | `page.tsx:82` | Anti-pattern propagation |
| **P1** | Add `featured-*` utility classes | `typography.css` | Token layer gap |
| **P1** | Add Mono + Caption + Featured sections to Foundations | `foundations/page.tsx` | 3 undocumented type scales |
| **P1** | Add `default`, `regular`, `selectable` card variants | `display/page.tsx` | 3 undocumented card variants |
| **P1** | Add `card-outline-error` / `card-outline-selected` | `display/page.tsx` | 2 undocumented state modifiers |
| **P1** | Add `outline` + `custom` to Buttons | `buttons/page.tsx` | 1 undocumented variant + size |
| **P1** | Fix hardcoded px in `modal.css` | `modal.css:76,77,224,230,231` | Token compliance |
| **P1** | Extend Text Tokens in gallery | `foundations/page.tsx` | 4 undocumented tokens |
| **P2** | Add Surface, Option, Shadow token sections | `foundations/page.tsx` | Multiple undocumented token groups |
| **P2** | Complete animations gallery | `feedback/page.tsx` | 8+ undocumented animation classes |
| **P2** | Fix `ghost` button token compliance | `button.tsx:26` | Fragile shadcn alias dependency |
| **P2** | Add gallery entries for 5 undocumented components | New/extended pages | InputGroup, TimeRangePicker, Calendar, Command, Sheet |
| **P3** | Fix `smooth-expand` layout thrash | `animations.css:222–238` | Minor perf improvement |
| **P3** | Add dash/obs token subsystem docs | Module-level docs | Discovery for subsystem developers |
