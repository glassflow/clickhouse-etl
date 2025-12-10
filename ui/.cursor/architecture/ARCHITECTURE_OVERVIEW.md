# Architecture Overview

## Technology Stack

- Framework: Next.js 16 (App Router)
- React: 19
- Language: TypeScript (strict)
- State: Zustand 5 (slice-based)
- UI: Shadcn UI (Radix primitives), Tailwind CSS 4
- Forms: React Hook Form 7 + Zod 3
- Theme: Dark-only via next-themes
- Auth: Auth0 (feature-flagged)
- HTTP: axios

## Layered Architecture

```
UI (components → hooks → store)
  ↓
Next.js API routes (app/ui-api/*) – proxy layer
  ↓
Client API (src/api/*) – type-safe calls
  ↓
Services (src/services/*) – business orchestration
  ↓
Libraries (src/lib/*) – external system clients (Kafka, ClickHouse)
  ↓
External systems (backend API, Kafka, ClickHouse)
```

## Key Decisions

- App Router with server-first approach; client components only when interactivity/hooks required.
- Proxy API routes (`/ui-api`) to backend; normalize payloads (for example, brokers/ports) before forwarding.
- Zustand slices per domain; core slice manages mode (create/edit/view), dirty state, hydration.
- Feature modules under `src/modules/*` encapsulate domain UI/logic.
- Forms are config + schema driven (configs in `src/config/*-form-config.ts`, schemas in `src/scheme/*`).
- Dark theme only; CSS custom properties and semantic tokens; Tailwind for layout/spacing.

## Data Flow (Pipeline lifecycle)

1. User edits UI (forms/components).
2. React Hook Form manages state; Zod validates.
3. Zustand slices updated; dirty state tracked.
4. API calls via client API → Next.js route → backend.
5. Responses hydrate slices; views render from store state.

## Directory Landmarks

- `src/app/` – pages + `/ui-api` routes (proxy layer)
- `src/components/ui/` – base primitives (Shadcn/Radix)
- `src/components/common/` – reusable app components
- `src/components/shared/` – app-wide/shared with light domain context
- `src/modules/*/` – feature modules (kafka, clickhouse, filter, join, deduplication, pipelines, review, create)
- `src/store/` – Zustand slices + hydration helpers
- `src/config/` – form configs
- `src/scheme/` – Zod schemas
- `src/services/` – service layer
- `src/lib/` – external clients
- `src/api/` – client-side API helpers

## Patterns

- Server/client boundary: default to server; add `'use client'` only when needed.
- Slice isolation: each domain slice owns its state and reset/validation helpers.
- Hydration: section-based hydration for partial discards; full hydration for pipeline load.
- Error handling: API layer normalizes errors; UI surfaces user-friendly messages (notifications/toasts).
- Type safety: infer types from Zod; avoid `any`.

## Related Docs

- Component Architecture: ./COMPONENT_ARCHITECTURE.md
- State Management: ./STATE_MANAGEMENT.md
- Form Architecture: ./FORM_ARCHITECTURE.md
- API Architecture: ./API_ARCHITECTURE.md
- Theming Architecture: ./THEMING_ARCHITECTURE.md
- Module Architecture: ./MODULE_ARCHITECTURE.md
