import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PipelinePage from '@/src/app/pipelines/[id]/page'
import { createMockPipeline } from './[id]/__tests__/test-helpers'
import { getPipeline } from '@/src/api/pipeline-api'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { isMockMode } from '@/src/utils/mock-api'

vi.mock('@/src/utils/auth-config.server', () => ({
  isAuthEnabled: vi.fn(() => false),
}))

vi.mock('@/src/lib/auth0', () => ({
  getSessionSafely: vi.fn(),
}))

vi.mock('@/src/api/pipeline-api', () => ({
  getPipeline: vi.fn(),
}))

vi.mock('@/src/utils/mock-api', () => ({
  isMockMode: vi.fn(() => false),
}))

const mockNotFound = vi.fn(() => {
  const err = new Error('NEXT_NOT_FOUND')
  ;(err as unknown as { digest: string }).digest = 'not-found'
  throw err
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    const err = new Error('NEXT_REDIRECT')
    ;(err as unknown as { digest: string }).digest = `redirect:${url}`
    throw err
  },
  notFound: (...args: unknown[]) => mockNotFound(...args),
}))

vi.mock('@/src/modules/pipelines/[id]/PipelineDetailsModule', () => ({
  default: ({ pipeline }: { pipeline: { name: string; pipeline_id: string } }) => (
    <div data-testid="ssr-pipeline-details-module">
      <span data-testid="ssr-pipeline-name">{pipeline.name}</span>
    </div>
  ),
}))

vi.mock('@/src/modules/pipelines/[id]/PipelineDetailsClientWrapper', () => ({
  default: ({ pipelineId }: { pipelineId: string }) => (
    <div data-testid="client-wrapper">
      <span data-testid="client-wrapper-id">{pipelineId}</span>
    </div>
  ),
}))


describe('PipelinePage (app/pipelines/[id]/page)', () => {
  const pipelineId = 'test-id-123'
  const params = Promise.resolve({ id: pipelineId })
  const searchParams = Promise.resolve({})

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAuthEnabled).mockReturnValue(false)
    vi.mocked(isMockMode).mockReturnValue(false)
  })

  it('renders PipelineDetailsModule with pipeline when SSR fetch succeeds', async () => {
    const pipeline = createMockPipeline({ pipeline_id: pipelineId, name: 'SSR Pipeline' })
    vi.mocked(getPipeline).mockResolvedValue(pipeline as Awaited<ReturnType<typeof getPipeline>>)

    const Page = await PipelinePage({ params, searchParams })

    render(Page)

    expect(screen.getByTestId('ssr-pipeline-details-module')).toBeInTheDocument()
    expect(screen.getByTestId('ssr-pipeline-name')).toHaveTextContent('SSR Pipeline')
  })

  it('renders PipelineDetailsClientWrapper when deployment=progress', async () => {
    const searchParamsWithDeployment = Promise.resolve({ deployment: 'progress' })

    const Page = await PipelinePage({ params, searchParams: searchParamsWithDeployment })

    render(Page)

    expect(screen.getByTestId('client-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('client-wrapper-id')).toHaveTextContent(pipelineId)
  })

  it('renders PipelineDetailsClientWrapper when isMockMode is true', async () => {
    vi.mocked(isMockMode).mockReturnValue(true)

    const Page = await PipelinePage({ params, searchParams })

    render(Page)

    expect(screen.getByTestId('client-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('client-wrapper-id')).toHaveTextContent(pipelineId)
  })

  it('calls notFound() when getPipeline returns 404', async () => {
    const err = new Error('Not found') as Error & { code?: number }
    err.code = 404
    vi.mocked(getPipeline).mockRejectedValue(err)

    await expect(PipelinePage({ params, searchParams })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders PipelineDetailsClientWrapper when getPipeline throws non-404 error', async () => {
    vi.mocked(getPipeline).mockRejectedValue(new Error('Server error'))

    const Page = await PipelinePage({ params, searchParams })

    render(Page)

    expect(screen.getByTestId('client-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('client-wrapper-id')).toHaveTextContent(pipelineId)
  })
})
