import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSchemaRegistryState } from './useSchemaRegistryState'

vi.mock('@/src/store', () => ({ useStore: vi.fn() }))
import { useStore } from '@/src/store'

const mockUpdateTopic = vi.fn()
const mockGetTopic = vi.fn()

function makeStore(topicOverride: any = null) {
  return {
    kafkaStore: {
      schemaRegistry: {
        url: 'http://registry.example.com',
        authMethod: 'none',
        enabled: true,
        apiKey: '',
        apiSecret: '',
        username: '',
        password: '',
      },
    },
    topicsStore: {
      getTopic: mockGetTopic.mockReturnValue(topicOverride),
      updateTopic: mockUpdateTopic,
    },
  }
}

describe('useSchemaRegistryState', () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue(makeStore() as any)
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, subjects: ['orders-value'] }),
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('does not fetch subjects on mount when topicName is empty', () => {
    renderHook(() => useSchemaRegistryState('', 0))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('fetches subjects when topicName is non-empty on mount', async () => {
    await act(async () => { renderHook(() => useSchemaRegistryState('orders', 0)) })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/subjects',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('fetches subjects when topicName changes from empty to non-empty', async () => {
    let topicName = ''
    const { rerender } = renderHook(() => useSchemaRegistryState(topicName, 0))
    expect(globalThis.fetch).not.toHaveBeenCalled()
    topicName = 'orders'
    await act(async () => { rerender() })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/subjects',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('auto-loads schema when selectVersion is called with subject already set', async () => {
    vi.mocked(globalThis.fetch as any)
      .mockResolvedValueOnce({ json: async () => ({ success: true, subjects: ['orders-value'] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, versions: [{ version: 3, label: 'v3' }] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, fields: [{ name: 'id', type: 'string' }], version: 3 }) })
    vi.mocked(useStore).mockReturnValue(
      makeStore({ index: 0, name: 'orders', schemaSource: 'internal' }) as any,
    )
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    await act(async () => { await result.current.selectSubject('orders-value') })
    await act(async () => { result.current.selectVersion('3') })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/schema',
      expect.objectContaining({ body: expect.stringContaining('"version":"3"') }),
    )
    expect(mockUpdateTopic).toHaveBeenCalledWith(
      expect.objectContaining({ schemaSource: 'external', schemaRegistrySubject: 'orders-value', schemaRegistryVersion: '3' }),
    )
  })

  it('clearAppliedSchema resets topic to internal and clears fields', () => {
    vi.mocked(useStore).mockReturnValue(
      makeStore({
        index: 0, name: 'orders', schemaSource: 'external',
        schemaRegistrySubject: 'orders-value', schemaRegistryVersion: '3',
        schema: { fields: [{ name: 'id', type: 'string', userType: 'string' }] },
      }) as any,
    )
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    act(() => { result.current.clearAppliedSchema() })
    expect(mockUpdateTopic).toHaveBeenCalledWith(
      expect.objectContaining({ schemaSource: 'internal', schemaRegistrySubject: undefined, schema: { fields: [] } }),
    )
  })

  it('dismissAutoResolved sets autoResolveDismissed true without writing to store', async () => {
    vi.mocked(globalThis.fetch as any).mockResolvedValue({
      json: async () => ({ success: true, schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] }),
    })
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    await act(async () => { await result.current.resolveFromEvent('AAAAA=') })
    expect(result.current.autoResolved).not.toBeNull()
    act(() => { result.current.dismissAutoResolved() })
    expect(result.current.autoResolveDismissed).toBe(true)
    expect(mockUpdateTopic).not.toHaveBeenCalled()
  })
})
