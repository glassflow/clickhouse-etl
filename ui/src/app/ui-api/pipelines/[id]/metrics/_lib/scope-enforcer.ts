/**
 * Server-side PromQL scope enforcement.
 *
 * Every PromQL query proxied through `/ui-api/pipelines/:id/metrics` is rewritten
 * here to inject `{pipeline_id="<id>"}` on each metric selector — even if the
 * client supplied a different `pipeline_id`. This is the contract that prevents
 * cross-pipeline leakage and is non-negotiable (see master plan § D5).
 */

const METRIC_NAME = /[a-zA-Z_][a-zA-Z_0-9:]*/.source
// metric_name optionally followed by selector  {label="value", ...} optionally
// followed by [duration]
const METRIC_RE = new RegExp(`(${METRIC_NAME})(\\{[^}]*\\})?(\\[[^\\]]+\\])?`, 'g')

const RESERVED = new Set([
  'rate',
  'irate',
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'increase',
  'topk',
  'bottomk',
  'histogram_quantile',
  'quantile',
  'stddev',
  'stdvar',
  'group',
  'absent',
  'time',
  'vector',
  'scalar',
  'on',
  'ignoring',
  'by',
  'without',
  'and',
  'or',
  'unless',
  'bool',
  'offset',
])

// Identifier-only tokens following `by` or `without` (e.g. `by (component)`)
// are label names, not metrics. We pre-mask those segments before scope rewriting
// using a non-identifier (vertical-tab) delimiter so the metric regex —
// which requires `[a-zA-Z_]` to start — won't match the placeholder.
const LABEL_LIST_RE = /\b(by|without)\s*\(([^)]*)\)/g
const PLACEHOLDER_DELIM = '\v' // U+000B vertical tab

export function enforcePipelineScope(query: string, pipelineId: string): string {
  let replaced = false

  const masks: string[] = []
  const masked = query.replace(LABEL_LIST_RE, (_full, kw: string, body: string) => {
    masks.push(`${kw} (${body})`)
    return `${PLACEHOLDER_DELIM}${masks.length - 1}${PLACEHOLDER_DELIM}`
  })

  const rewritten = masked.replace(
    METRIC_RE,
    (full, name: string, selector: string | undefined, range: string | undefined) => {
      if (RESERVED.has(name)) return full
      replaced = true
      const inner = parseSelectorBody(selector ?? '')
      const overridden = inner.filter((kv) => kv.label !== 'pipeline_id')
      overridden.push({ label: 'pipeline_id', op: '=', value: pipelineId })
      const renderedSelector = `{${overridden.map(renderKv).join(',')}}`
      return `${name}${renderedSelector}${range ?? ''}`
    },
  )

  // Restore label-name lists.
  const out = rewritten.replace(
    new RegExp(`${PLACEHOLDER_DELIM}(\\d+)${PLACEHOLDER_DELIM}`, 'g'),
    (_full, idx: string) => masks[Number(idx)] ?? '',
  )

  if (!replaced) {
    throw new Error('no metric in expression')
  }
  return out
}

type SelectorKV = { label: string; op: '=' | '!=' | '=~' | '!~'; value: string }

function parseSelectorBody(body: string): SelectorKV[] {
  const trimmed = body.replace(/^\{|\}$/g, '').trim()
  if (!trimmed) return []
  return trimmed.split(',').map((part) => {
    const m = part.trim().match(/^([a-zA-Z_][a-zA-Z_0-9]*)(=~|!=|!~|=)"([^"]*)"$/)
    if (!m) throw new Error(`bad selector part: ${part}`)
    return { label: m[1], op: m[2] as SelectorKV['op'], value: m[3] }
  })
}

function renderKv({ label, op, value }: SelectorKV): string {
  return `${label}${op}"${value.replace(/"/g, '\\"')}"`
}
