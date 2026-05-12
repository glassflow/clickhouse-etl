'use client'

import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { useStore } from '@/src/store'

const LS_KEY = 'obs.autoRefreshIntervalMs.v1'

const OPTIONS: { label: string; value: number | null }[] = [
  { label: 'off', value: null },
  { label: '15s', value: 15_000 },
  { label: '30s', value: 30_000 },
  { label: '60s', value: 60_000 },
]

function valueToString(v: number | null): string {
  return v == null ? 'off' : String(v)
}

function stringToValue(s: string): number | null {
  return s === 'off' ? null : Number(s)
}

export function AutoRefreshControl() {
  const { observabilityStore } = useStore()

  React.useEffect(() => {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw == null) return
    const v = raw === 'null' ? null : Number(raw)
    if (v !== observabilityStore.autoRefreshIntervalMs) {
      observabilityStore.setAutoRefreshIntervalMs(v)
    }
  }, [])

  const handleChange = (s: string) => {
    const v = stringToValue(s)
    observabilityStore.setAutoRefreshIntervalMs(v)
    window.localStorage.setItem(LS_KEY, v == null ? 'null' : String(v))
  }

  return (
    <Select value={valueToString(observabilityStore.autoRefreshIntervalMs)} onValueChange={handleChange}>
      <SelectTrigger className="w-[88px] h-7 caption-1" aria-label="Auto-refresh interval">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.label} value={valueToString(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
