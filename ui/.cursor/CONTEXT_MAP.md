# Context Loading Map

Use this map to choose which rules and docs to load for a given task; skills can reference rows by area.

| When you work on… | Load first |
|-------------------|------------|
| Kafka module | `.cursor/modules.mdc` + `docs/modules/kafka/*` |
| Transformation module | `.cursor/architecture/STATE_MANAGEMENT.md` + `docs/modules/transformations/*` |
| Notification center (panel, settings, channels) | `.cursor/architecture/NOTIFICATION_CENTER.md` + `docs/modules/notifications/NOTIFICATIONS.md` |
| In-app feedback (toast/banner/modal) | `.cursor/architecture/IN_APP_NOTIFICATIONS.md` |
| UI styling / tokens / cards | `.cursor/styling.mdc` + `docs/architecture/DESIGN_SYSTEM.md` |
| Pipeline list or details (status, actions) | `.cursor/architecture/IMPLEMENTATIONS_INDEX.md` + SSE (and related) implementation doc |
| Forms / validation | `.cursor/forms.mdc` + `.cursor/architecture/FORM_ARCHITECTURE.md` |
| API / proxy layer | `.cursor/api.mdc` + `.cursor/architecture/API_ARCHITECTURE.md` |

## Related

- Rules and architecture index: `.cursor/index.mdc`
- Docs index: `docs/README.md`
