'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Mirror a single piece of UI state into the URL query string. Updates use
 * `router.replace(...)` so they don't push history entries on every keystroke.
 *
 * - `key` — the URL search parameter name
 * - `initial` — fallback when the param is absent
 * - `serialize` — value → string (default: `String(v)`)
 * - `deserialize` — string → value (default: identity cast)
 *
 * The setter is stable across renders even though it closes over `params`
 * (we read the current params off `URLSearchParams` inside).
 *
 * Use the convenience `useUrlStateArray` for comma-separated lists.
 */
export function useUrlState<T>(
  key: string,
  initial: T,
  serialize: (v: T) => string = (v) => String(v),
  deserialize: (s: string) => T = (s) => s as unknown as T,
): [T, (v: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params?.get(key) ?? null

  const value = React.useMemo(
    () => (raw != null ? deserialize(raw) : initial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw],
  )

  const set = React.useCallback(
    (v: T) => {
      const next = new URLSearchParams(params?.toString() ?? '')
      const s = serialize(v)
      if (s) next.set(key, s)
      else next.delete(key)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname ?? '/', { scroll: false })
    },
    [params, pathname, router, key, serialize],
  )

  return [value, set]
}

/**
 * Convenience: comma-separated list backed by `useUrlState`. Empty arrays
 * remove the key entirely so a fresh URL doesn't accumulate empty params.
 */
export function useUrlStateArray(
  key: string,
  initial: string[],
): [string[], (v: string[]) => void] {
  const serialize = React.useCallback((arr: string[]) => arr.join(','), [])
  const deserialize = React.useCallback(
    (s: string) => (s ? s.split(',').filter(Boolean) : []),
    [],
  )
  return useUrlState<string[]>(key, initial, serialize, deserialize)
}
