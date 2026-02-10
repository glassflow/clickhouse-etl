# Key Implementations Index

The following look like normal UI or config flows but have specific behavior or constraints. Read the linked doc before changing them.

Implementation notes and PRDs live in `docs/implementations/`. This index points agents and developers to the right doc for each area.

| Topic | Description | Constraint / risk | Doc |
|-------|-------------|-------------------|-----|
| **SSE pipeline status streaming** | Real-time pipeline status via Server-Sent Events; replaces client polling. Route `/ui-api/pipeline/status/stream`, client `pipelineSSEManager`. | Replacing with client polling will regress scalability and increase server load. | [docs/implementations/SSE_PIPELINE_STATUS_STREAMING.md](../../docs/implementations/SSE_PIPELINE_STATUS_STREAMING.md) |
| **Kerberos** | Kafka Kerberos auth and Go-based gateway integration. | Uses gateway; not plain KafkaJS. Changing auth path can break Kerberos flows. | [docs/implementations/KERBEROS_IMPLEMENTATION_SUMMARY.md](../../docs/implementations/KERBEROS_IMPLEMENTATION_SUMMARY.md) |
| **Store mode support** | PRD for store mode behavior and support. | Behavior and feature flags are specified in the PRD. | [docs/implementations/STORE_MODE_SUPPORT_PRD.md](../../docs/implementations/STORE_MODE_SUPPORT_PRD.md) |

When changing pipeline list/details status behavior, Kafka auth, or store-mode-related features, consult the corresponding implementation doc.

## Related

- Architecture overview: ./ARCHITECTURE_OVERVIEW.md
- Docs index: [docs/README.md](../../docs/README.md)
