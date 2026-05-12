import { describe, it, expect } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { createObservabilitySlice, type ObservabilitySlice } from './observability.store'

function makeStore() {
  return createStore<ObservabilitySlice>()((set, get, api) => createObservabilitySlice(set, get, api))
}

describe('observabilityStore.autoRefreshIntervalMs', () => {
  it('defaults to 30000 (30s)', () => {
    const store = makeStore()
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBe(30_000)
  })

  it('setAutoRefreshIntervalMs(null) disables polling', () => {
    const store = makeStore()
    store.getState().observabilityStore.setAutoRefreshIntervalMs(null)
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBeNull()
  })

  it('setAutoRefreshIntervalMs(15000) updates the interval', () => {
    const store = makeStore()
    store.getState().observabilityStore.setAutoRefreshIntervalMs(15_000)
    expect(store.getState().observabilityStore.autoRefreshIntervalMs).toBe(15_000)
  })
})
