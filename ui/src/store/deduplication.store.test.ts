import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createDeduplicationSlice, DeduplicationSlice, type DeduplicationConfig } from './deduplication.store'

const useTestStore = create<DeduplicationSlice>()(createDeduplicationSlice)

const sampleConfig: DeduplicationConfig = {
  enabled: true,
  window: 2,
  unit: 'hours',
  key: 'id',
  keyType: 'string',
}

describe('deduplication store', () => {
  beforeEach(() => {
    useTestStore.getState().deduplicationStore.resetDeduplicationStore()
  })

  it('updateDeduplication stores config and getDeduplication returns it', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)

    expect(deduplicationStore.getDeduplication(0)).toEqual(sampleConfig)
  })

  it('updateDeduplication does not affect other indices', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)
    deduplicationStore.updateDeduplication(2, { ...sampleConfig, key: 'userId' })

    expect(deduplicationStore.getDeduplication(0)?.key).toBe('id')
    expect(deduplicationStore.getDeduplication(2)?.key).toBe('userId')
  })

  it('skipDeduplication sets enabled false and clears key/window for that index', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)
    deduplicationStore.skipDeduplication(0)

    const config = deduplicationStore.getDeduplication(0)
    expect(config?.enabled).toBe(false)
    expect(config?.key).toBe('')
    expect(config?.window).toBe(0)
    expect(config?.keyType).toBe('')
  })

  it('skipDeduplication does not affect other indices', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)
    deduplicationStore.updateDeduplication(1, { ...sampleConfig, key: 'id2' })
    deduplicationStore.skipDeduplication(0)

    expect(deduplicationStore.getDeduplication(1)).toEqual({
      ...sampleConfig,
      key: 'id2',
    })
  })

  it('invalidateDeduplication resets config to default and marks validation invalidated', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)
    deduplicationStore.invalidateDeduplication(0)

    const config = deduplicationStore.getDeduplication(0)
    expect(config).toEqual({
      enabled: true,
      window: 1,
      unit: 'minutes',
      key: '',
      keyType: '',
    })
    expect(useTestStore.getState().deduplicationStore.validation.status).toBe('invalidated')
    expect(useTestStore.getState().deduplicationStore.validation.invalidatedBy).toBe('topic-changed')
  })

  it('resetDeduplicationStore clears all configs and resets validation', () => {
    const { deduplicationStore } = useTestStore.getState()
    deduplicationStore.updateDeduplication(0, sampleConfig)
    deduplicationStore.updateDeduplication(1, { ...sampleConfig, key: 'id2' })
    deduplicationStore.resetDeduplicationStore()

    expect(deduplicationStore.getDeduplication(0)).toBeUndefined()
    expect(deduplicationStore.getDeduplication(1)).toBeUndefined()
    expect(useTestStore.getState().deduplicationStore.deduplicationConfigs).toEqual({})
    expect(useTestStore.getState().deduplicationStore.validation.status).toBe('not-configured')
  })
})
