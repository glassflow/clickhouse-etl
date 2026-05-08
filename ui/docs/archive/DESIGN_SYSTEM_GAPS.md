# Design System — Gap Analysis

> Reference for the visual consolidation sprint.
> Components page lives at `/dev/components`.
> Last updated: 2026-05-08 | Branch: `ui-ux-revamp-2.0`

---

## What the Components Page Currently Covers

### ✅ Well covered (all variants + states shown)
| Category | Components |
|---|---|
| **Buttons** | `Button` — 9 variants, 5 sizes, loading + disabled states |
| **Forms** | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `SearchableSelect`, `DualSearchableSelect` |
| **Display** | `Badge` — 7 variants · `Card` — 6 variants + selected/error modifiers · `Avatar` · `Table` |
| **Navigation** | `Tabs`, `Accordion` |
| **Overlays** | `Dialog` — 3 patterns · `Tooltip` · `Popover` · `DropdownMenu` |
| **Feedback** | `Alert` — 4 variants · `Toast/Sonner` — 6 patterns · 7 animations |
| **Foundations** | Typography scale · Semantic colors · Surface tokens · Text tokens · Border radius · Spacing |

---

## What's Missing — UI Primitives (`src/components/ui/`)

These components exist in the codebase and are used across features, but have **zero documentation** on the components page.

| Component | File | Used in | Priority |
|---|---|---|---|
| `Skeleton` | `skeleton.tsx` | Loading states everywhere | 🔴 High |
| `EmptyState` | `empty-state.tsx` | Library, Pipelines, Dashboard | 🔴 High |
| `Drawer` | `drawer.tsx` | NodeConfigPanel, AI drawer | 🔴 High |
| `Sheet` | `sheet.tsx` | Various overlays | 🔴 High |
| `Pill` | `pill.tsx` | Filters, tags, status chips | 🔴 High |
| `LiveIndicator` | `live-indicator.tsx` | Metrics, Logs live-tail | 🔴 High |
| `Sparkline` | `sparkline.tsx` | Dashboard KPI cards, MiniMetricsStrip | 🔴 High |
| `ScopeBadge` | `scope-badge.tsx` | Metrics + Logs scope enforcement | 🟡 Medium |
| `KbdHint` | `kbd-hint.tsx` | Keyboard shortcut hints (⌘K) | 🟡 Medium |
| `Crumbs` | `crumbs.tsx` | Library + Pipeline detail breadcrumbs | 🟡 Medium |
| `TimeRangePicker` | `time-range-picker.tsx` | Metrics + Logs toolbars | 🟡 Medium |
| `Calendar` | `calendar.tsx` | Custom date range modal | 🟡 Medium |
| `Command` | `command.tsx` | Search palette | 🟡 Medium |
| `InputGroup` | `input-group.tsx` | Form patterns | 🟡 Medium |
| `Form` | `form.tsx` | Form utility wrapper | 🟡 Medium (utility) |

---

## What's Missing — Common Components (`src/components/common/`)

Application-level patterns that should be documented so all new features use them consistently instead of re-implementing variants.

| Component | File | Priority |
|---|---|---|
| `ConfirmationModal` | `ConfirmationModal.tsx` | 🔴 High — used for all destructive actions |
| `FormModal` | `FormModal.tsx` | 🔴 High — generic form-in-modal pattern |
| `InfoModal` | `InfoModal.tsx` | 🔴 High — info/alert modal variant |
| `InputModal` | `InputModal.tsx` | 🔴 High — text-prompt modal |
| `DownloadFormatModal` | `DownloadFormatModal.tsx` | 🟡 Medium |
| `SaveToLibraryPrompt` | `SaveToLibraryPrompt.tsx` | 🟡 Medium |
| `MultipleSelect` | `MultipleSelect.tsx` | 🟡 Medium |
| `SelectEnhanced` | `SelectEnhanced.tsx` | 🟡 Medium |
| `InputFile` + `CertificateFileUpload` | both | 🟡 Medium |
| `BasicDropdown` / `SimpleDropdown` | both | 🟡 Medium (may consolidate) |

---

## What's Missing — Animation Utilities

The components page shows 7 animations but `animations.css` defines significantly more:

| Class | Purpose | Shown |
|---|---|---|
| `animate-fadeIn` | Fade in | ✅ |
| `animate-slideDown` | Slide down | ✅ |
| `animate-slideDownFade` | Slide down + fade | ✅ |
| `animate-pulse` | Pulse | ✅ |
| `animate-slideUpFade` | Slide up + fade | ✅ |
| `animate-fade-in-up` | Fade in upward | ✅ |
| `animate-slideInFromRight` | Slide in from right | ✅ |
| `animate-fadeInOpacity` | Opacity fade | ❌ |
| `animate-section-enter` | Section entrance | ❌ |
| `animate-flow-dot` | Flow dot (canvas) | ❌ |
| `animate-drawerSlideInRight/Out/Left` | Drawer transitions | ❌ |
| `animate-fadeOut` | Fade out | ❌ |
| `animate-skeletonShimmer` | Skeleton loading | ❌ |
| `animate-livePulse` | Live indicator | ❌ |
| `animate-delay-100/200/300/400` | Delay utilities | ✅ |
| `smooth-expand` + `.expanded` | Accordion/expand | ❌ |

---

## Figma Code Connect Coverage

| Component | Has `.figma.tsx` |
|---|---|
| Button | ✅ |
| Badge | ✅ |
| Card | ✅ |
| Modal (common) | ✅ |
| **Everything else** | ❌ |

Current coverage: **4 / 37 UI components (11%)**

Not a blocker for the visual consolidation sprint — but should be addressed before the next token sync (`pnpm figma:publish`).

---

## Components Page — Recommended Additions

Prioritized by impact on the visual consistency sprint.

### Sprint 1 — Add before visual audit begins (unlocks audit reference)

1. **Skeleton** — show shimmer variants at card, text, avatar, and table-row sizes
2. **EmptyState** — show the 3 use cases: no data, error, restricted access
3. **Drawer / Sheet** — show open/closed, different anchor sides
4. **Pill** — show all filter-pill states: default, active, removable, disabled
5. **LiveIndicator** — show live (green pulse) and paused variants
6. **Sparkline** — show positive/negative/flat trends, with and without tooltip
7. **Confirmation / Form / Info / Input modals** — canonical patterns for destructive actions and forms

### Sprint 2 — Add during or after visual audit

8. **ScopeBadge** — show scoped / unscoped states
9. **KbdHint** — show single key and chord (⌘K)
10. **Crumbs** — show 2, 3, 4-level breadcrumb paths
11. **TimeRangePicker** — show preset list + custom date range
12. **Calendar** — date-range selection demo
13. **Full animation library** — all delay utilities, drawer transitions, skeleton shimmer, live pulse

---

## Visual Audit Checklist (per surface)

Use the components page as the reference. For each surface, check:

- [ ] Typography: are `title-*`, `body-*`, `caption-*` classes used (not raw Tailwind `text-*` sizes)?
- [ ] Colors: zero hardcoded hex/rgba? All values via `var(--token-name)`?
- [ ] Buttons: `<Button variant="...">` used, never `<button className="...">`?
- [ ] Cards: `<Card variant="...">` used, never raw div with `bg-*` utilities?
- [ ] Badges: `<Badge variant="...">` used for status chips?
- [ ] Empty state: `<EmptyState>` component used, not ad-hoc JSX?
- [ ] Loading state: `<Skeleton>` used, same layout dimensions as populated state?
- [ ] Error state: scoped error (per card/query), not full-page blank?
- [ ] Spacing: Tailwind spacing utilities (`p-4`, `gap-6`) only — no inline `style={{ margin: ... }}`?
- [ ] Modals: `DialogOverlay` + `DialogContent` pattern from `CLAUDE.md` § 5?
