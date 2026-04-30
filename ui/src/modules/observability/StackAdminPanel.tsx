'use client'

import { Card } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Badge } from '@/src/components/ui/badge'
import { useObservabilityStack } from '@/src/hooks/useObservabilityStack'
import { useObservabilityFlag } from '@/src/hooks/useObservabilityFlag'
import { RetentionBar } from './RetentionBar'
import { FanOutDiagram } from './FanOutDiagram'
import { CardinalityTable } from './CardinalityTable'
import { M3M4M5Roadmap } from './M3M4M5Roadmap'

/**
 * Workspace › Observability admin panel.
 *
 * Renders four cards stacked vertically:
 *   1. Vmsingle + VictoriaLogs retention bars (side-by-side)
 *   2. OTEL collector fan-out diagram
 *   3. Cardinality probes
 *   4. M3 / M4 / M5 roadmap
 *
 * Mirrors the design contract that observability is *pipeline-scope-enforced*
 * server-side (see master plan § D5). The stack here describes only the stack
 * itself — it does not run unscoped queries against pipeline data.
 */
export function StackAdminPanel() {
  const { data, error, isLoading } = useObservabilityStack()
  const enabled = useObservabilityFlag()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? 'success' : 'outline'}>
          Internal stack: {enabled ? 'enabled' : 'disabled'}
        </Badge>
        <Badge variant="secondary">Scope: pipeline-only</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="dark" className="p-5">
          <h3 className="title-6 text-[var(--text-primary)] mb-3">vmsingle</h3>
          {isLoading ? (
            <Skeleton width="100%" height={48} />
          ) : (
            <RetentionBar
              label={`v${data?.vmsingle.version ?? '?'}`}
              retention={data?.vmsingle.retention ?? '7d'}
              diskUsageBytes={data?.vmsingle.diskUsageBytes ?? null}
              diskQuotaBytes={data?.vmsingle.diskQuotaBytes ?? null}
            />
          )}
        </Card>
        <Card variant="dark" className="p-5">
          <h3 className="title-6 text-[var(--text-primary)] mb-3">VictoriaLogs</h3>
          {isLoading ? (
            <Skeleton width="100%" height={48} />
          ) : (
            <RetentionBar
              label={`v${data?.victoriaLogs.version ?? '?'}`}
              retention={data?.victoriaLogs.retention ?? '3d'}
              diskUsageBytes={data?.victoriaLogs.diskUsageBytes ?? null}
              diskQuotaBytes={data?.victoriaLogs.diskQuotaBytes ?? null}
            />
          )}
        </Card>
      </div>

      <Card variant="dark" className="p-5">
        <h3 className="title-6 text-[var(--text-primary)] mb-3">OTEL collector fan-out</h3>
        {isLoading ? (
          <Skeleton width="100%" height={120} />
        ) : (
          <FanOutDiagram
            collectorEndpoint={data?.fanOut.collectorEndpoint ?? null}
            external={data?.fanOut.external ?? []}
            internalEnabled={enabled}
          />
        )}
      </Card>

      <Card variant="dark" className="p-5">
        <h3 className="title-6 text-[var(--text-primary)] mb-3">Cardinality guard</h3>
        {isLoading ? (
          <Skeleton width="100%" height={80} />
        ) : (
          <CardinalityTable probes={data?.cardinality ?? []} />
        )}
      </Card>

      <Card variant="dark" className="p-5">
        <h3 className="title-6 text-[var(--text-primary)] mb-3">Roadmap</h3>
        <M3M4M5Roadmap />
      </Card>

      {error && (
        <p className="caption-1 text-[var(--color-foreground-critical)]">
          Failed to load stack info: {error}
        </p>
      )}
    </div>
  )
}
