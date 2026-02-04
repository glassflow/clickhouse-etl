import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePipelineDetailsData } from './usePipelineDetailsData'
import { getPipeline } from '@/src/api/pipeline-api'
import { createMockPipeline } from '@/src/modules/pipelines/[id]/__tests__/test-helpers'

vi.mock('@/src/api/pipeline-api', () => ({
  getPipeline: vi.fn(),
}))

vi.mock('@/src/notifications/api-error-handler', () => ({
  handleApiError: vi.fn(),
}))

describe('usePipelineDetailsData', () => {
  const pipelineId = 'test-pipeline-id'
  const pipeline = createMockPipeline({ pipeline_id: pipelineId, name: 'Test Pipeline' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with loading true when skipInitialFetch is false', () => {
    vi.mocked(getPipeline).mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => usePipelineDetailsData(pipelineId))

    expect(result.current.loading).toBe(true)
    expect(result.current.pipeline).toBe(null)
    expect(result.current.error).toBe(null)
    expect(result.current.isNotFound).toBe(false)
  })

  it('starts with loading false when skipInitialFetch is true', () => {
    const { result } = renderHook(() =>
      usePipelineDetailsData(pipelineId, { skipInitialFetch: true })
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.pipeline).toBe(null)
  })

  it('sets pipeline and clears loading on successful fetch', async () => {
    vi.mocked(getPipeline).mockResolvedValue(pipeline as Awaited<ReturnType<typeof getPipeline>>)

    const { result } = renderHook(() => usePipelineDetailsData(pipelineId))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.pipeline).toEqual(pipeline)
    expect(result.current.error).toBe(null)
    expect(result.current.isNotFound).toBe(false)
  })

  it('sets isNotFound when getPipeline returns 404', async () => {
    const err = new Error('Not found') as Error & { code?: number }
    err.code = 404
    vi.mocked(getPipeline).mockRejectedValue(err)

    const { result } = renderHook(() => usePipelineDetailsData(pipelineId))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isNotFound).toBe(true)
    expect(result.current.pipeline).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('sets error when getPipeline throws non-404', async () => {
    vi.mocked(getPipeline).mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => usePipelineDetailsData(pipelineId))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.pipeline).toBe(null)
    expect(result.current.isNotFound).toBe(false)
  })

  it('refetch allows manual re-fetch', async () => {
    vi.mocked(getPipeline).mockResolvedValue(pipeline as Awaited<ReturnType<typeof getPipeline>>)

    const { result } = renderHook(() =>
      usePipelineDetailsData(pipelineId, { skipInitialFetch: true })
    )

    expect(result.current.pipeline).toBe(null)

    let refetched: typeof pipeline | null = null
    await act(async () => {
      refetched = await result.current.refetch()
    })

    expect(refetched).toEqual(pipeline)
    expect(getPipeline).toHaveBeenCalledWith(pipelineId)
    expect(result.current.pipeline).toEqual(pipeline)
  })

  it('setPipeline updates local pipeline state', async () => {
    vi.mocked(getPipeline).mockResolvedValue(pipeline as Awaited<ReturnType<typeof getPipeline>>)

    const { result } = renderHook(() => usePipelineDetailsData(pipelineId))

    await waitFor(() => {
      expect(result.current.pipeline).toEqual(pipeline)
    })

    const updated = createMockPipeline({ pipeline_id: pipelineId, name: 'Updated Name' })
    act(() => {
      result.current.setPipeline(updated)
    })

    await waitFor(() => {
      expect(result.current.pipeline?.name).toBe('Updated Name')
    })
  })
})
