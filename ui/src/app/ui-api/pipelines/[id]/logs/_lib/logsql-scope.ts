/**
 * Server-side LogsQL scope enforcement.
 *
 * Every LogsQL query proxied through `/ui-api/pipelines/:id/logs` (and the
 * SSE tail variant) is rewritten here to prepend `pipeline_id:"<id>"` — and
 * any client-supplied `pipeline_id` filter (positive or negated) is stripped
 * first so a forged value cannot leak across pipelines. This is the contract
 * that mirrors the Phase 5 PromQL scope-enforcer for VictoriaLogs and is
 * non-negotiable (see master plan § D5).
 */

const PIPELINE_ID_RE = /(?:^|\s)-?pipeline_id:"[^"]*"/g

export function enforceLogsPipelineScope(query: string, pipelineId: string): string {
  const stripped = query.replace(PIPELINE_ID_RE, '').trim()
  const escaped = pipelineId.replace(/"/g, '\\"')
  if (!stripped) return `pipeline_id:"${escaped}"`
  return `pipeline_id:"${escaped}" ${stripped}`
}
