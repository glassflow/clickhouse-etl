/**
 * Resource defaults for pipeline creation.
 * Reads from NEXT_PUBLIC_RESOURCE_DEFAULTS (env/ConfigMap) when set.
 * Falls back to hardcoded defaults matching API §6.1 when unset (local dev, older deployments).
 */

import { getRuntimeEnv } from '@/src/utils/common.client'
import type { PipelineResources } from '@/src/types/pipeline'

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

/**
 * Get resource defaults for the Resources step during pipeline creation.
 * Uses NEXT_PUBLIC_RESOURCE_DEFAULTS from env when set; otherwise returns hardcoded defaults.
 */
export function getResourceDefaults(): PipelineResources {
  const env = typeof window !== 'undefined' ? getRuntimeEnv() : null
  const raw = (env as Record<string, string | undefined> | null)?.NEXT_PUBLIC_RESOURCE_DEFAULTS ?? process.env.NEXT_PUBLIC_RESOURCE_DEFAULTS

  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { ...JSON.parse(JSON.stringify(HARDCODED_DEFAULTS)) }
  }

  try {
    const parsed = JSON.parse(raw) as PipelineResources
    return deepMergeDefaults(HARDCODED_DEFAULTS, parsed)
  } catch {
    return { ...JSON.parse(JSON.stringify(HARDCODED_DEFAULTS)) }
  }
}

function deepMergeDefaults<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults }

  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const overrideVal = overrides[key]
    if (overrideVal === undefined || overrideVal === null) continue

    const defaultVal = defaults[key]
    if (
      typeof overrideVal === 'object' &&
      overrideVal !== null &&
      !Array.isArray(overrideVal) &&
      typeof defaultVal === 'object' &&
      defaultVal !== null &&
      !Array.isArray(defaultVal)
    ) {
      ;(result as any)[key] = deepMergeDefaults(defaultVal as Record<string, any>, overrideVal)
    } else {
      ;(result as any)[key] = overrideVal
    }
  }

  return result
}
