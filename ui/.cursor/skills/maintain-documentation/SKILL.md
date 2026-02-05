---
name: maintain-documentation
description: Keeps project documentation aligned with implementation. Use when adding a new feature, changing architecture, adding a module or store slice, adding an implementation (e.g. SSE/Kerberos-like), or when the user asks to update docs, align documentation with code, or keep docs in sync.
---

# Maintain Documentation

Apply this skill when implementing a new feature or changing behavior so that both **docs/** (canonical truth) and **.cursor/** (rules and summaries) stay accurate and discoverable.

## Where documentation lives

- **Map:** [.cursor/index.mdc](../index.mdc) (rules + architecture list), [docs/README.md](../../docs/README.md) (docs index), [.cursor/CONTEXT_MAP.md](../CONTEXT_MAP.md) (what to load per area).
- **Ownership:** `docs/` owns full architecture, design system, module behavior, implementations. `.cursor/` owns operational rules and **summaries + links only**. Rule: `.cursor/architecture/*` must not contain unique facts that do not exist in `docs/`; add to docs first, then summarize or link from .cursor.

## Quick reference

| Layer                                         | Canonical (add here first)                                                | .cursor (summaries + links only)                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Full architecture                             | `docs/architecture/ARCHITECTURE_OVERVIEW.md`                              | `.cursor/architecture/ARCHITECTURE_OVERVIEW.md` (modules/slices/critical flows lists + link to docs)                       |
| Design system / tokens                        | `docs/architecture/DESIGN_SYSTEM.md`                                      | `.cursor/styling.mdc`, `.cursor/architecture/THEMING_ARCHITECTURE.md` (point to docs)                                      |
| Module behavior                               | `docs/modules/<module>/` (e.g. one or more `.md` per feature)             | `.cursor/architecture/MODULE_ARCHITECTURE.md` (one-line entry), CONTEXT_MAP row                                            |
| Implementations (SSE, auth, store mode, etc.) | `docs/implementations/<name>.md`                                          | `.cursor/architecture/IMPLEMENTATIONS_INDEX.md` (row + constraint/risk + link)                                             |
| State / store                                 | Reflected in `docs/architecture/ARCHITECTURE_OVERVIEW.md` (store section) | `.cursor/architecture/STATE_MANAGEMENT.md`, `.cursor/state-management.mdc` (slice names), ARCHITECTURE_OVERVIEW store list |

## Workflow by change type

### New feature or new module

1. **Canonical:** Add or update `docs/modules/<module-name>/` with at least one doc (e.g. `MODULE_NAME.md`): component hierarchy, key files, state/API, types. Follow existing module docs (e.g. `docs/modules/kafka/`, `docs/modules/notifications/`) for structure.
2. **.cursor:** Add one line to `.cursor/architecture/MODULE_ARCHITECTURE.md` under "Notable modules". Add the module to the "Modules" list in `.cursor/architecture/ARCHITECTURE_OVERVIEW.md`. Add a row to `.cursor/CONTEXT_MAP.md` ("When you work on…" → "Load first"). Add the module to the "Modules" table in `docs/README.md` if not already there.
3. **Vocabulary:** If the feature involves "notifications", use **notification center** for the product feature (panel, store, channels) and **in-app notifications** for the `notify()` toast/banner/modal system; see `.cursor/architecture/NOTIFICATION_CENTER.md` vs `IN_APP_NOTIFICATIONS.md`.

### New store slice

1. **Canonical:** Update `docs/architecture/ARCHITECTURE_OVERVIEW.md` (store structure / Service responsibilities or equivalent).
2. **.cursor:** Add the slice to the "Store composition" and "Domain slices" sections in `.cursor/architecture/STATE_MANAGEMENT.md`. Add the slice name to the list in `.cursor/state-management.mdc`. Add the slice to the "Store slices" list in `.cursor/architecture/ARCHITECTURE_OVERVIEW.md`. If the slice participates in pipeline hydration, add it to the Hydration section in STATE_MANAGEMENT.md and to `hydrateSection` options.

### New implementation (non-obvious behavior)

When adding something that looks like normal UI but has specific constraints (e.g. a new streaming mechanism, auth path, or feature-flag–driven behavior):

1. **Canonical:** Add `docs/implementations/<NAME>.md` (overview, architecture, key files, constraints/risks).
2. **.cursor:** Add a row to `.cursor/architecture/IMPLEMENTATIONS_INDEX.md` with topic, short description, **constraint/risk** one-liner, and link to the doc. Optionally add the flow to the "Critical flows index" in `.cursor/architecture/ARCHITECTURE_OVERVIEW.md`.

### Styling / design system changes

1. **Canonical:** All new tokens, card variants, and usage live in `docs/architecture/DESIGN_SYSTEM.md`. Do not add token or variant definitions only in .cursor.
2. **.cursor:** Keep `.cursor/styling.mdc` and `.cursor/architecture/THEMING_ARCHITECTURE.md` as directives and summaries that point to DESIGN_SYSTEM.md; no new unique token names or values only in .cursor.

### Architecture or data-flow change

1. **Canonical:** Update `docs/architecture/ARCHITECTURE_OVERVIEW.md` (tech stack, directory tree, data flows, store, API, invariants as needed).
2. **.cursor:** Update the snapshot in `.cursor/architecture/ARCHITECTURE_OVERVIEW.md`: ensure the modules list, store slices list, and "Critical flows index" match reality and link to docs. Do not add new architectural facts only in .cursor.

## Checklist before finishing

- [ ] Every new fact or detailed behavior is recorded in **docs/** first (appropriate file under `docs/architecture/`, `docs/modules/`, or `docs/implementations/`).
- [ ] `.cursor/architecture/*` only summarizes or links; no unique facts that exist only there.
- [ ] If a new module or area was added: CONTEXT_MAP.md has a row; docs/README.md and MODULE_ARCHITECTURE / ARCHITECTURE_OVERVIEW lists are updated.
- [ ] If a new implementation or hidden constraint was added: IMPLEMENTATIONS_INDEX.md has a row with constraint/risk and link.
- [ ] Naming: "Notification center" vs "in-app notifications" used consistently; no ambiguous "notifications" when both could apply.

## Key file paths (from repo root `ui/`)

- Rules and ownership: `.cursor/index.mdc`
- Docs index: `docs/README.md`
- Context map: `.cursor/CONTEXT_MAP.md`
- Architecture snapshot: `.cursor/architecture/ARCHITECTURE_OVERVIEW.md`
- Full architecture: `docs/architecture/ARCHITECTURE_OVERVIEW.md`
- Design system: `docs/architecture/DESIGN_SYSTEM.md`
- Implementations index: `.cursor/architecture/IMPLEMENTATIONS_INDEX.md`
- Module list: `.cursor/architecture/MODULE_ARCHITECTURE.md`
- State/slices: `.cursor/architecture/STATE_MANAGEMENT.md`, `.cursor/state-management.mdc`
