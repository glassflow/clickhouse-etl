import { StateCreator } from 'zustand'
import type { TimeRangeKey } from '@/src/components/ui/time-range-picker'

export type AbsoluteRange = { fromMs: number; toMs: number }

export type BrushedRangeSource = 'metrics_drill_down' | 'logs'

export interface ObservabilityState {
  rangeKey: TimeRangeKey
  customRange: AbsoluteRange | null
  brushedRange: (AbsoluteRange & { source: BrushedRangeSource }) | null
  autoRefresh: boolean // poll every 30s when range is "now"-anchored
}

export interface ObservabilityActions {
  setRangeKey: (key: TimeRangeKey) => void
  setCustomRange: (range: AbsoluteRange | null) => void
  pinBrushedRange: (range: AbsoluteRange, source: BrushedRangeSource) => void
  clearBrushedRange: () => void
  setAutoRefresh: (b: boolean) => void
}

export interface ObservabilitySlice {
  observabilityStore: ObservabilityState & ObservabilityActions
}

export const createObservabilitySlice: StateCreator<ObservabilitySlice> = (set) => ({
  observabilityStore: {
    rangeKey: '1h',
    customRange: null,
    brushedRange: null,
    autoRefresh: true,

    setRangeKey: (rangeKey) =>
      set((s) => ({ observabilityStore: { ...s.observabilityStore, rangeKey } })),
    setCustomRange: (customRange) =>
      set((s) => ({ observabilityStore: { ...s.observabilityStore, customRange } })),
    pinBrushedRange: (range, source) =>
      set((s) => ({
        observabilityStore: {
          ...s.observabilityStore,
          brushedRange: { ...range, source },
        },
      })),
    clearBrushedRange: () =>
      set((s) => ({ observabilityStore: { ...s.observabilityStore, brushedRange: null } })),
    setAutoRefresh: (autoRefresh) =>
      set((s) => ({ observabilityStore: { ...s.observabilityStore, autoRefresh } })),
  },
})
