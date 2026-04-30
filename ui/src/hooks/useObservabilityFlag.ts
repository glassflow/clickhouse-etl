'use client'

import * as React from 'react'
import { getRuntimeEnv } from '@/src/utils/common.client'

/**
 * Reads `NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED` from runtime env.
 *
 * Falls back to `false` so missing config = BYO (bring-your-own observability).
 * Memoized; runtime env doesn't change after the page mounts.
 */
export function useObservabilityFlag(): boolean {
  return React.useMemo(() => {
    const env = getRuntimeEnv()
    const v = env?.NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED
    return v === 'true' || v === '1'
  }, [])
}
