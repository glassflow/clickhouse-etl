# Notification Center (product feature)

The notification center is the product feature for pipeline notifications: slide-out panel, full page at `/notifications`, settings (Slack/Email channels, severity mappings), and persistence via the backend (GlassFlow Notifier).

## Key pieces

- **Store:** `src/store/notifications.store.ts` – list, filters, pagination, selection, panel state.
- **Module:** `src/modules/notifications/` – NotificationManagement, NotificationSettingsPanel, NotificationFilters, NotificationTable, channel config (Slack/Email), SeverityMappings.
- **UI:** `src/components/notifications/` – NotificationsPanel, NotificationItem; `src/components/shared/NotificationBadge.tsx`.
- **API:** `src/services/notifications-api.ts`; Next.js routes under `app/ui-api/notifications/`.
- **Feature flag:** `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` (see `src/config/feature-flags.ts`).

## Key invariants

- Feature flag gates all notification-center UI (badge, panel, pages); when disabled, routes redirect and API returns 403.
- Notification center state is independent of pipeline hydration; it is loaded and updated via its own API and store actions, not `hydrateSection` / pipeline config.

## Full documentation

For component hierarchy, state shape, API methods, types, and user flows, see:

**[docs/modules/notifications/NOTIFICATIONS.md](../../docs/modules/notifications/NOTIFICATIONS.md)**

## Related

- In-app feedback (toast/banner/modal via `notify()`): ./IN_APP_NOTIFICATIONS.md
