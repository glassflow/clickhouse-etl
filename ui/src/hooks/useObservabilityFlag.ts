'use client'

import * as React from 'react'
import { getRuntimeEnv } from '@/src/utils/common.client'

/**
 * Reads `NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED` from runtime env.
 *
 * Order:
 *   1. `window.__ENV__` (Docker-runtime injection, populated by `runtime-env.js`)
 *   2. `process.env.NEXT_PUBLIC_*` (Next.js inlines this at build time — used in `pnpm dev`
 *      and in production builds where `window.__ENV__` isn't reachable)
 *
 * Falls back to `false` so missing config = BYO (bring-your-own observability).
 * Memoized; runtime env doesn't change after the page mounts.
 */
export function useObservabilityFlag(): boolean {
  return React.useMemo(() => {
    const runtime = getRuntimeEnv()
    const v =
      runtime?.NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED ?? process.env.NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED
    return v === 'true' || v === '1'
  }, [])
}
