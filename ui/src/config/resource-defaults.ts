/**
 * Resource defaults for pipeline creation.
 * Reads from individual NEXT_PUBLIC_* env vars when set; falls back to hardcoded defaults when unset.
 */

import { getRuntimeEnv } from '@/src/utils/common.client'
import type { PipelineResources } from '@/src/types/pipeline'

/** Env var names for resource defaults (UI: NEXT_PUBLIC_ prefix for client access). */
export const RESOURCE_DEFAULT_ENV_KEYS = [
  'NEXT_PUBLIC_NATS_MAX_STREAM_AGE',
  'NEXT_PUBLIC_NATS_MAX_STREAM_BYTES',
  'NEXT_PUBLIC_INGESTOR_CPU_REQUEST',
  'NEXT_PUBLIC_INGESTOR_CPU_LIMIT',
  'NEXT_PUBLIC_INGESTOR_MEMORY_REQUEST',
  'NEXT_PUBLIC_INGESTOR_MEMORY_LIMIT',
  'NEXT_PUBLIC_JOIN_CPU_REQUEST',
  'NEXT_PUBLIC_JOIN_CPU_LIMIT',
  'NEXT_PUBLIC_JOIN_MEMORY_REQUEST',
  'NEXT_PUBLIC_JOIN_MEMORY_LIMIT',
  'NEXT_PUBLIC_SINK_CPU_REQUEST',
  'NEXT_PUBLIC_SINK_CPU_LIMIT',
  'NEXT_PUBLIC_SINK_MEMORY_REQUEST',
  'NEXT_PUBLIC_SINK_MEMORY_LIMIT',
  'NEXT_PUBLIC_DEDUP_CPU_REQUEST',
  'NEXT_PUBLIC_DEDUP_CPU_LIMIT',
  'NEXT_PUBLIC_DEDUP_MEMORY_REQUEST',
  'NEXT_PUBLIC_DEDUP_MEMORY_LIMIT',
  'NEXT_PUBLIC_DEDUP_STORAGE_SIZE',
  'NEXT_PUBLIC_DEDUP_STORAGE_CLASS',
] as const

const HARDCODED_DEFAULTS: PipelineResources = {
  nats: {
    stream: {
      maxAge: '24h',
      maxBytes: '0',
    },
  },
  ingestor: {
    base: {
      requests: { cpu: '100m', memory: '128Mi' },
      limits: { cpu: '1500m', memory: '1.5Gi' },
      replicas: 1,
    },
  },
  join: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '1500m', memory: '1.5Gi' },
    replicas: 1,
  },
  sink: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '1500m', memory: '1.5Gi' },
  },
  transform: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '1500m', memory: '1.5Gi' },
    storage: { size: '10Gi' },
    replicas: 1,
  },
}

function getEnv(): Record<string, string | undefined> {
  if (typeof window !== 'undefined') {
    const runtime = getRuntimeEnv() as Record<string, string | undefined> | null
    return runtime ?? {}
  }
  return { ...process.env }
}

/**
 * Build PipelineResources from individual NEXT_PUBLIC_* env vars.
 * Only overwrites when the env var is set and non-empty.
 * Replicas stay at 1 (no env vars for them).
 * NEXT_PUBLIC_DEDUP_STORAGE_CLASS is read but not applied to the object until API supports it.
 */
export function resourceDefaultsFromEnv(env: Record<string, string | undefined>): PipelineResources {
  const out = JSON.parse(JSON.stringify(HARDCODED_DEFAULTS)) as PipelineResources

  const str = (key: string): string | undefined => {
    const v = env[key]
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  }

  if (out.nats?.stream) {
    const v = str('NEXT_PUBLIC_NATS_MAX_STREAM_AGE')
    if (v != null) out.nats.stream.maxAge = v
    const v2 = str('NEXT_PUBLIC_NATS_MAX_STREAM_BYTES')
    if (v2 != null) out.nats.stream.maxBytes = v2
  }

  if (out.ingestor?.base) {
    const r = out.ingestor.base.requests
    const l = out.ingestor.base.limits
    if (r) {
      const v = str('NEXT_PUBLIC_INGESTOR_CPU_REQUEST')
      if (v != null) r.cpu = v
      const v2 = str('NEXT_PUBLIC_INGESTOR_MEMORY_REQUEST')
      if (v2 != null) r.memory = v2
    }
    if (l) {
      const v = str('NEXT_PUBLIC_INGESTOR_CPU_LIMIT')
      if (v != null) l.cpu = v
      const v2 = str('NEXT_PUBLIC_INGESTOR_MEMORY_LIMIT')
      if (v2 != null) l.memory = v2
    }
  }

  if (out.join) {
    const r = out.join.requests
    const l = out.join.limits
    if (r) {
      const v = str('NEXT_PUBLIC_JOIN_CPU_REQUEST')
      if (v != null) r.cpu = v
      const v2 = str('NEXT_PUBLIC_JOIN_MEMORY_REQUEST')
      if (v2 != null) r.memory = v2
    }
    if (l) {
      const v = str('NEXT_PUBLIC_JOIN_CPU_LIMIT')
      if (v != null) l.cpu = v
      const v2 = str('NEXT_PUBLIC_JOIN_MEMORY_LIMIT')
      if (v2 != null) l.memory = v2
    }
  }

  if (out.sink) {
    const r = out.sink.requests
    const l = out.sink.limits
    if (r) {
      const v = str('NEXT_PUBLIC_SINK_CPU_REQUEST')
      if (v != null) r.cpu = v
      const v2 = str('NEXT_PUBLIC_SINK_MEMORY_REQUEST')
      if (v2 != null) r.memory = v2
    }
    if (l) {
      const v = str('NEXT_PUBLIC_SINK_CPU_LIMIT')
      if (v != null) l.cpu = v
      const v2 = str('NEXT_PUBLIC_SINK_MEMORY_LIMIT')
      if (v2 != null) l.memory = v2
    }
  }

  if (out.transform) {
    const r = out.transform.requests
    const l = out.transform.limits
    if (r) {
      const v = str('NEXT_PUBLIC_DEDUP_CPU_REQUEST')
      if (v != null) r.cpu = v
      const v2 = str('NEXT_PUBLIC_DEDUP_MEMORY_REQUEST')
      if (v2 != null) r.memory = v2
    }
    if (l) {
      const v = str('NEXT_PUBLIC_DEDUP_CPU_LIMIT')
      if (v != null) l.cpu = v
      const v2 = str('NEXT_PUBLIC_DEDUP_MEMORY_LIMIT')
      if (v2 != null) l.memory = v2
    }
    if (out.transform.storage) {
      const v = str('NEXT_PUBLIC_DEDUP_STORAGE_SIZE')
      if (v != null) out.transform!.storage!.size = v
      // NEXT_PUBLIC_DEDUP_STORAGE_CLASS not applied to object until API supports it
    }
  }

  return out
}

/**
 * Get resource defaults for the Resources step during pipeline creation.
 * Builds from individual NEXT_PUBLIC_* env vars over hardcoded defaults.
 */
export function getResourceDefaults(): PipelineResources {
  return resourceDefaultsFromEnv(getEnv())
}
