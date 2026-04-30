'use client'

type Probe = { label: string; value: number | null }

type CardinalityTableProps = {
  probes: Probe[]
}

/**
 * Two-column table rendering cardinality probes returned from
 * `/ui-api/observability/stack`. Cells with `value === null` show `—` so
 * an unreachable upstream still produces a coherent row.
 */
export function CardinalityTable({ probes }: CardinalityTableProps) {
  if (probes.length === 0) {
    return (
      <p className="body-3 text-[var(--text-secondary)]">
        No cardinality probes returned.
      </p>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--surface-border)]">
          <th className="text-left caption-1 text-[var(--text-tertiary)] uppercase tracking-wider py-2">
            Metric
          </th>
          <th className="text-right caption-1 text-[var(--text-tertiary)] uppercase tracking-wider py-2">
            Value
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--surface-border)]">
        {probes.map((p) => (
          <tr key={p.label}>
            <td className="body-3 text-[var(--text-primary)] py-2">{p.label}</td>
            <td className="mono-1 text-right text-[var(--text-primary)] py-2">
              {p.value != null ? p.value.toLocaleString() : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
