/**
 * runtime.store.ts — A7: Runtime Observability Stub
 *
 * Reserved for future observability data: throughput, lag, error rate.
 * Populated by /observability SSE stream in a future sprint.
 *
 * Design-time configuration lives in coreStore / domainStore.
 * Deployment metadata (status, version, timestamps) lives in deploymentStore.
 */

import { StateCreator } from 'zustand'

export interface RuntimeState {
  // Reserved for future observability data: throughput, lag, error rate
  // Populated by /observability SSE stream in a future sprint
}

export interface RuntimeActions {
  reset: () => void
}

export interface RuntimeSlice {
  runtimeStore: RuntimeState & RuntimeActions
}

const initialRuntime: RuntimeState = {}

export const createRuntimeSlice: StateCreator<RuntimeSlice> = (set) => ({
  runtimeStore: {
    ...initialRuntime,
    reset: () =>
      set((s) => ({
        runtimeStore: { ...s.runtimeStore, ...initialRuntime },
      })),
  },
})
