# Notifications Architecture

## Overview

Centralized notification system with multiple channels (toast, banner, modal, inline) and typed messages. Entry point is `notify(options)` with per-channel providers.

## Key Files

- `src/notifications/notify.ts` – main router; defaults to toast. Holds banner/modal contexts set by providers.
- `src/notifications/types.ts` – variants, channels, options, actions, banner/modal state, flash message shape.
- `src/notifications/channels/*` – channel implementations:
  - `toast.tsx` – sonner-based toasts with custom rendering, truncation/expand for long errors, action/report links.
  - `banner-provider.tsx` / `modal.tsx` / `inline.tsx` / `banner.tsx` – other delivery channels.
- `src/notifications/messages/*` – curated message factories by domain (auth, kafka, clickhouse, pipeline, network, validation, etc.).
- `src/notifications/api-error-handler.ts` – maps API errors to user-facing notifications.
- `src/notifications/index.ts` – exports `notify`, `useNotify`, message helpers.

## Usage

- **Basic**: `notify({ variant: 'error', title: 'Failed', description: '...' })` (toast default).
- **Channel override**: `notify({ channel: 'banner', ... })`; falls back to toast if provider missing.
- **Actions**: Provide `action: { label, onClick }`; toasts render call-to-action and close.
- **Links**: `reportLink`/`documentationLink` for guidance; toast channel renders report link.
- **Inline**: Use `useNotify` or inline components directly; `notify` throws if `channel: 'inline'`.

## Providers and Contexts

- `notify` stores banner/modal contexts set by provider components. If not set, it logs a warning and falls back to toast.
- Ensure banner/modal providers are mounted high enough (e.g., app layout/providers) for those channels.

## Patterns

- Use message factories from `src/notifications/messages/*` for consistent copy and variants per domain.
- Prefer `api-error-handler.ts` to translate API errors into user-friendly notifications.
- Keep descriptions user-focused; leverage truncation/expand for long error payloads (toast).
- Set `duration` for toasts; use `persistent` for banner/modal when appropriate.

## Extending

- Add new channel under `channels/`, expose a `showX` helper, and wire context in `notify.ts`.
- Add domain-specific messages under `messages/` to keep strings centralized.
- Keep variants constrained to `success | info | warning | error`.

## Related Docs

- Component rules: `.cursor/components.mdc`
- API rules (for error handling): `.cursor/api.mdc`
