import { NextResponse } from 'next/server'

const VM_BASE = process.env.VICTORIA_METRICS_URL ?? 'http://victoriametrics:8428'
const VL_BASE = process.env.VICTORIA_LOGS_URL ?? 'http://victorialogs:9428'

export type ObservabilityStackResponse = {
  vmsingle: {
    version: string | null
    retention: string
    diskUsageBytes: number | null
    diskQuotaBytes: number | null
  }
  victoriaLogs: {
    version: string | null
    retention: string
    diskUsageBytes: number | null
    diskQuotaBytes: number | null
  }
  fanOut: {
    collectorEndpoint: string | null
    external: Array<{ name: string; url: string }>
  }
  cardinality: Array<{ label: string; value: number | null }>
}

/**
 * GET /ui-api/observability/stack
 *
 * Aggregates admin metadata about the internal observability stack:
 * - vmsingle / VictoriaLogs build info + retention + disk usage
 * - OTEL collector fan-out targets (parsed from env)
 * - Cardinality probes against vmsingle
 *
 * All upstream calls are wrapped in `Promise.allSettled` / catch so the
 * panel renders even when only part of the stack is reachable.
 */
export async function GET(): Promise<NextResponse> {
  const [vm, vl] = await Promise.allSettled([
    fetchInfo(`${VM_BASE}/api/v1/status/buildinfo`),
    fetchInfo(`${VL_BASE}/-/buildinfo`),
  ])

  const vmInfo = vm.status === 'fulfilled' ? vm.value : null
  const vlInfo = vl.status === 'fulfilled' ? vl.value : null

  const [vmDisk, vlDisk] = await Promise.all([
    fetchUsage(`${VM_BASE}/api/v1/query?query=vm_data_size_bytes`).catch(() => null),
    fetchUsage(`${VL_BASE}/select/logsql/query?query=*&limit=0`).catch(() => null),
  ])

  // Cardinality guard: a couple of probes that catch the typical "label
  // explosion" failure mode (too many distinct series / pipeline_ids).
  const cardinalityProbes = [
    { label: 'series total', vmQuery: 'vm_cache_entries{type="storage/tsid"}' },
    {
      label: 'distinct pipeline_ids',
      vmQuery: 'count(count by (pipeline_id) (glassflow_records_ingested_total))',
    },
  ]
  const cardinality = await Promise.all(
    cardinalityProbes.map(async (p) => {
      const v = await fetchUsage(
        `${VM_BASE}/api/v1/query?query=${encodeURIComponent(p.vmQuery)}`,
      ).catch(() => null)
      return { label: p.label, value: v }
    }),
  )

  const body: ObservabilityStackResponse = {
    vmsingle: {
      version: vmInfo?.data?.version ?? null,
      retention: process.env.VM_RETENTION ?? '7d',
      diskUsageBytes: vmDisk,
      diskQuotaBytes: process.env.VM_DISK_QUOTA_BYTES
        ? Number(process.env.VM_DISK_QUOTA_BYTES)
        : null,
    },
    victoriaLogs: {
      version: vlInfo?.data?.version ?? null,
      retention: process.env.VL_RETENTION ?? '3d',
      diskUsageBytes: vlDisk,
      diskQuotaBytes: process.env.VL_DISK_QUOTA_BYTES
        ? Number(process.env.VL_DISK_QUOTA_BYTES)
        : null,
    },
    fanOut: {
      collectorEndpoint: process.env.OTEL_COLLECTOR_ENDPOINT ?? null,
      external: parseFanOutTargets(),
    },
    cardinality,
  }

  return NextResponse.json(body)
}

async function fetchInfo(url: string): Promise<{ data?: { version?: string } }> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchUsage(url: string): Promise<number | null> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { result?: Array<{ value?: [number, string] }> }
  }
  const v = json?.data?.result?.[0]?.value?.[1]
  return v != null ? Number(v) : null
}

function parseFanOutTargets(): Array<{ name: string; url: string }> {
  const raw = process.env.OBSERVABILITY_FANOUT_TARGETS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, url] = s.split('=')
      return { name: name ?? 'unnamed', url: url ?? '' }
    })
    .filter((t) => t.url)
}
