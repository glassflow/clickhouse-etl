
  Summary

  The complete revamp 2.0 implementation plan is now saved across 10 files at docs/superpowers/plans/2026-04-29-ui-revamp-2.0-*.md:

  ┌───────┬────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Phase │          File          │                                                                          What it lands                                                                           │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ —     │ master.md              │ Index, dependency graph, 5 architectural decisions, file-touchpoint matrix                                                                                       │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 0     │ phase-0-foundations.md │ Tokens, mono font, 9 new UI primitives (Drawer/Pill/EmptyState/Skeleton/Crumbs/Sparkline/ScopeBadge/LiveIndicator/TimeRangePicker), nav update, recharts         │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1     │ phase-1-library.md     │ DB versions tables, schema versioning + diff + publish flow, transforms tab, blast-radius dialog, used-by lists                                                  │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2     │ phase-2-canvas.md      │ Pipeline detail nested-route tabs, NodePalette, ValidationBadge/Footer, LibraryChip, DeployBar                                                                   │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3     │ phase-3-bridge.md      │ pipeline_revisions + pipeline_references tables, Library Links tab, DriftBanner, UpgradeModal, BulkRolloutModal                                                  │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4     │ phase-4-ai.md          │ Right-side AI drawer, SSE streaming, tool-call cards (pipeline.draft/library.search/validate), per-scope persistence                                             │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 5     │ phase-5-metrics.md     │ VictoriaMetrics proxy with server-side scope enforcement, 3 hero + 6 chart grid, brushed range, drill-down                                                       │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 6     │ phase-6-logs.md        │ VictoriaLogs proxy, SSE live tail, LogsQL search, filter pills, log inspector drawer, range correlation                                                          │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 7     │ phase-7-admin.md       │ Disabled/BYO state, Workspace → Observability admin (versions, retention bars, fan-out diagram, cardinality)                                                     │
  ├───────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 8     │ phase-8-polish.md      │ Cross-module CTAs, unsaved-changes guard, type-incompatible edge rejection, context expansion clustering, URL state, custom date range, audits, responsive sweep │
  └───────┴────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Parallelism baked in: After Phase 0, Phases 1, 2, 4, 5, 7 can run in parallel. Phase 3 needs 1+2; Phase 6 needs 5; Phase 8 is last. Three engineers running {0→1→3}, {0→2→5→6}, {0→4 + 7} collapses ~30 engineering-days to ~3-4 calendar weeks.

  Each phase is independently shippable: Bite-sized tasks with TDD steps, exact file paths, full code snippets (no placeholders), specific test commands, and a per-phase PR template. The known gaps from earlier phases (Phase 2's edge rejection, Phase 6's context expansion, etc.) are explicitly captured as Phase 8 follow-ups so each PR can merge without blocking.

  Execution options per phase: Both Subagent-Driven (superpowers:subagent-driven-development) and Inline Execution (superpowers:executing-plans) are supported per the writing-plans skill.

  Want me to kick off Phase 0 inline, or hand it to a subagent?
