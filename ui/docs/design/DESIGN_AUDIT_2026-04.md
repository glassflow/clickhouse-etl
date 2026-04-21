# Design Audit — April 2026

> Branch: `design-audit` | Date: 2026-04-18

## Score: 25/40 (Below Satisfactory)

The token system and wizard sidebar are well-built. The home page and presentation layer have visible anti-pattern debt that undercuts the "premium dev tool" brand.

---

## Nielsen Heuristics

| # | Heuristic | Score | Finding |
|---|-----------|-------|---------|
| 1 | Visibility of System Status | 2/4 | Plain-text "Loading pipelines..." — no spinner, no skeleton |
| 2 | Match System / Real World | 3/4 | Domain terminology correct (Kafka, topic, pipeline) |
| 3 | User Control and Freedom | 3/4 | Import path, wizard back-nav, cancel on all modals |
| 4 | Consistency and Standards | 2/4 | 12 typography violations; raw Tailwind orange; 21 brightness-0 hacks |
| 5 | Error Prevention | 3/4 | Confirmation modals for destructive actions; pipeline limit guard |
| 6 | Recognition Rather Than Recall | 2/4 | 8 identical selectable cards; muted labels on choices |
| 7 | Flexibility and Efficiency | 2/4 | No keyboard shortcuts; import buried below fold |
| 8 | Aesthetic and Minimalist Design | 2/4 | Gradient text on h1; redundant copy; muted interactive labels |
| 9 | Error Recovery | 3/4 | Import errors surface well; silent fetch failure in PipelinesPageClient |
| 10 | Help and Documentation | 3/4 | Help menu present; zero inline contextual help at decisions |

---

## Confirmed Anti-Patterns (with file references)

| Pattern | Count | Files |
|---------|-------|-------|
| **Gradient text** (`text-brand-gradient`) | 2 production uses | `HomePageClient.tsx:273`, `app/page.tsx:61` |
| **Raw Tailwind orange** | 2 | `Header.tsx:354`, `UserProfile.tsx:40` |
| **Typography system bypassed** | 12 | error/not-found pages, `PipelinesList.tsx`, `NoPipelines.tsx`, notifications pages |
| **Muted text on interactive cards** | 8 | All `Card variant="selectable"` in `HomePageClient.tsx` |
| **`filter brightness-0` icon hack** | 21 | `NoPipelines.tsx`, `TableContextMenu.tsx` (7×), `PipelineDetailsHeader.tsx` (9×), `PipelineActionsMenu.tsx`, `DestinationErrorBlock.tsx` |
| **`›` active state indicator** | 2 | `WizardSidebar.tsx:144`, `PipelineDetailsSidebar.tsx` |
| **`hover:opacity-70` on interactive elements** | 3 | `PipelinesList.tsx`, `PipelinesTable.tsx`, `FilterChip.tsx` |
| **Bare empty state** | 1 | `NoPipelines.tsx` |
| **Redundant section copy** | 2 | `HomePageClient.tsx:281-286`, `:352-357` |
| **Excessive top padding (home page dead zone)** | 1 | `HomePageClient.tsx:271-272` |

---

## Priority Issues (planned fixes)

### P0 — Gradient text on primary heading (DONE: 2026-04-18)
- Removed `.text-brand-gradient` from `HomePageClient.tsx:273` and `app/page.tsx:61`
- `.title-1` already applies `color: var(--text-accent)` (solid orange — more distinctive than the generic gradient)

### P1 — Home page: muted labels, redundant copy, dead zone padding (DONE: 2026-04-18)
- Changed all 8 card button labels from `text-muted-foreground` → appropriate primary text
- Removed redundant subtitle descriptions from 2 sections
- Reduced top padding from `py-20`+`py-16` stacked to sensible values

### P1 — Icon system: 21 `filter brightness-0` hacks → Heroicons (DONE: 2026-04-18)
- Migrated action icon `<Image src={svg}>` to Heroicons components in affected files
- Removed all `filter brightness-0` / `brightness-100 group-hover:brightness-0` workarounds

### P2 — States & microcopy (DONE: 2026-04-18)
- Loading state in `PipelinesPageClient.tsx` → spinner + skeleton rows
- Empty state in `NoPipelines.tsx` → educational content + docs link
- InfoModal buttons → action verbs instead of generic "Yes"/"No"

### P2 — Nav indicator raw Tailwind (DONE: 2026-04-18)
- `Header.tsx:354` `from-orange-300/30 via-orange-400` → CSS variable tokens

### P3 — Typography system consistency (tracked, not addressed in this session)
- 12 files bypassing `.title-*` utility classes with raw `text-2xl font-semibold`
- Target: error pages, not-found, notifications pages, logs page

---

## What Was Deliberately Not Changed
- Primary orange color (`--color-orange-300` / `#ffa24b`)
- Dark theme (dark-only)
- Gradient CTA button (`variant="gradient"`)
- Nav tab underline gradient indicator (preserved, only fixed token usage)
- `surface-gradient-border` modal signature
- `WizardSidebar` connector-line mechanic (working well)
