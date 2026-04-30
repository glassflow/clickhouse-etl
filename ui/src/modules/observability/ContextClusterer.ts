import type { LogLine } from '@/src/hooks/useLogsQuery'

export type ClusterItem =
  | { kind: 'line'; line: LogLine; index: number }
  | { kind: 'gap'; collapsedCount: number; startIndex: number; endIndex: number }

/**
 * Cluster log lines into match-groups for context-aware rendering.
 *
 * - When `query` is empty/whitespace, returns every line as a `line` item
 *   in order (no gaps). The list still works as a flat render.
 * - When `query` is non-empty, lines whose `_msg` contains the term
 *   (case-insensitive) become anchors; surrounding lines within
 *   `contextRadius` are also kept. Stretches of non-match lines outside
 *   any anchor's window collapse into a single `gap` item with the run
 *   length and original [startIndex, endIndex] preserved.
 *
 * The renderer in `LogsTab` uses `<ContextExpander>` against gap items so
 * users can expand them on demand. `index` on `line` items is the original
 * index in the input array — handy as a stable React key.
 */
export function clusterLogs(
  lines: LogLine[],
  query: string,
  contextRadius = 5,
): ClusterItem[] {
  if (!query.trim()) {
    return lines.map((line, index) => ({ kind: 'line' as const, line, index }))
  }

  const term = query.toLowerCase()
  const matchIdx = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const msg = String(lines[i]._msg ?? '').toLowerCase()
    if (msg.includes(term)) {
      const lo = Math.max(0, i - contextRadius)
      const hi = Math.min(lines.length - 1, i + contextRadius)
      for (let j = lo; j <= hi; j++) matchIdx.add(j)
    }
  }

  const out: ClusterItem[] = []
  let gapStart: number | null = null

  for (let i = 0; i < lines.length; i++) {
    if (matchIdx.has(i)) {
      if (gapStart !== null) {
        out.push({
          kind: 'gap',
          collapsedCount: i - gapStart,
          startIndex: gapStart,
          endIndex: i - 1,
        })
        gapStart = null
      }
      out.push({ kind: 'line', line: lines[i], index: i })
    } else {
      if (gapStart === null) gapStart = i
    }
  }
  if (gapStart !== null) {
    out.push({
      kind: 'gap',
      collapsedCount: lines.length - gapStart,
      startIndex: gapStart,
      endIndex: lines.length - 1,
    })
  }

  return out
}
