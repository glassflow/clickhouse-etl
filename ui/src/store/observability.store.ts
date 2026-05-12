import { StateCreator } from 'zustand'
import type { TimeRangeKey } from '@/src/components/ui/time-range-picker'

export type AbsoluteRange = { fromMs: number; toMs: number }

export type BrushedRangeSource = 'metrics_drill_down' | 'logs'

export interface ObservabilityState {
  rangeKey: TimeRangeKey
  customRange: AbsoluteRange | null
  brushedRange: (AbsoluteRange & { source: BrushedRangeSource }) | null
  autoRefreshIntervalMs: number | null // poll interval in ms; null = off
}

export interface ObservabilityActions {
  setRangeKey: (key: TimeRangeKey) => void
  setCustomRange: (range: AbsoluteRange | null) => void
  pinBrushedRange: (range: AbsoluteRange, source: BrushedRangeSource) => void
  clearBrushedRange: () => void
  setAutoRefreshIntervalMs: (ms: number | null) => void
}

export interface ObservabilitySlice {
  observabilityStore: ObservabilityState & ObservabilityActions
}

export const createObservabilitySlice: StateCreator<ObservabilitySlice> = (set) => ({
  observabilityStore: {
    rangeKey: '1h',
    customRange: null,
    brushedRange: null,
    autoRefreshIntervalMs: 30_000,

    setRangeKey: (rangeKey) => set((s) => ({ observabilityStore: { ...s.observabilityStore, rangeKey } })),
    setCustomRange: (customRange) => set((s) => ({ observabilityStore: { ...s.observabilityStore, customRange } })),
    pinBrushedRange: (range, source) =>
      set((s) => ({
        observabilityStore: {
          ...s.observabilityStore,
          brushedRange: { ...range, source },
        },
      })),
    clearBrushedRange: () => set((s) => ({ observabilityStore: { ...s.observabilityStore, brushedRange: null } })),
    setAutoRefreshIntervalMs: (autoRefreshIntervalMs) =>
      set((s) => ({ observabilityStore: { ...s.observabilityStore, autoRefreshIntervalMs } })),
  },
})
