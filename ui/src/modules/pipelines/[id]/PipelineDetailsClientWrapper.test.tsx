import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PipelineDetailsClientWrapper from './PipelineDetailsClientWrapper'
import { createMockPipeline } from './__tests__/test-helpers'
import { usePipelineDetailsData } from '@/src/hooks/usePipelineDetailsData'

const mockPush = vi.fn()
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

const mockRefetch = vi.fn()
const mockSetPipeline = vi.fn()

vi.mock('@/src/hooks/usePipelineDetailsData', () => ({
  usePipelineDetailsData: vi.fn(),
}))

const mockStoreState = {
  coreStore: { pipelineName: null },
}

vi.mock('@/src/store', () => ({
  useStore: (selector?: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState)
    }
    return mockStoreState
  },
}))

vi.mock('./PipelineDetailsModule', () => ({
  default: ({ pipeline }: { pipeline: { name: string; pipeline_id: string } }) => (
    <div data-testid="pipeline-details-module">
      <span data-testid="module-pipeline-name">{pipeline.name}</span>
      <span data-testid="module-pipeline-id">{pipeline.pipeline_id}</span>
    </div>
  ),
}))

vi.mock('../PipelineNotFound', () => ({
  PipelineNotFound: ({ pipelineId }: { pipelineId: string }) => (
    <div data-testid="pipeline-not-found">
      <span data-testid="not-found-id">{pipelineId}</span>
    </div>
  ),
}))

vi.mock('./PipelineDeploymentProgress', () => ({
  default: ({
    pipelineId: id,
    pipelineName,
    onDeploymentComplete,
    onDeploymentFailed,
    onNavigateToList,
  }: {
    pipelineId: string;
    pipelineName: string;
    onDeploymentComplete: () => void;
    onDeploymentFailed: (error: string) => void;
    onNavigateToList: () => void;
  }) => (
    <div data-testid="deployment-progress">
      <span data-testid="deploy-pipeline-id">{id}</span>
      <span data-testid="deploy-pipeline-name">{pipelineName}</span>
      <button type="button" onClick={onDeploymentComplete} data-testid="deploy-complete">
        Complete
      </button>
      <button type="button" onClick={() => onDeploymentFailed('error')} data-testid="deploy-failed">
        Failed
      </button>
      <button type="button" onClick={onNavigateToList} data-testid="deploy-navigate-list">
        Back to list
      </button>
    </div>
  ),
}))

describe('PipelineDetailsClientWrapper', () => {
  const pipelineId = 'test-pipeline-123'
  const pipeline = createMockPipeline({ pipeline_id: pipelineId, name: 'My Pipeline' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })
  })

  it('shows loading state when loading is true', () => {
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: true,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByText('Loading pipeline details...')).toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-details-module')).not.toBeInTheDocument()
  })

  it('shows PipelineNotFound when isNotFound is true', () => {
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: true,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByTestId('pipeline-not-found')).toBeInTheDocument()
    expect(screen.getByTestId('not-found-id')).toHaveTextContent(pipelineId)
  })

  it('shows error UI when error is set', () => {
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: 'Failed to fetch pipeline',
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch pipeline')).toBeInTheDocument()
  })

  it('renders PipelineDetailsModule when pipeline is loaded', () => {
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByTestId('pipeline-details-module')).toBeInTheDocument()
    expect(screen.getByTestId('module-pipeline-name')).toHaveTextContent('My Pipeline')
    expect(screen.getByTestId('module-pipeline-id')).toHaveTextContent(pipelineId)
  })

  it('shows fallback "Pipeline Not Found" when pipeline is null after loading', () => {
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByText('Pipeline Not Found')).toBeInTheDocument()
    expect(screen.getByText(/Pipeline with ID .* could not be found/)).toBeInTheDocument()
  })

  it('shows PipelineDeploymentProgress when deployment=progress search param is set', () => {
    mockSearchParams = new URLSearchParams({ deployment: 'progress' })
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    expect(screen.getByTestId('deployment-progress')).toBeInTheDocument()
    expect(screen.getByTestId('deploy-pipeline-id')).toHaveTextContent(pipelineId)
  })

  it('calls router.replace and refetch when deployment completes', () => {
    mockSearchParams = new URLSearchParams({ deployment: 'progress' })
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    fireEvent.click(screen.getByTestId('deploy-complete'))

    expect(mockReplace).toHaveBeenCalledWith(`/pipelines/${pipelineId}`)
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('calls router.push(/pipelines) when deployment fails', () => {
    mockSearchParams = new URLSearchParams({ deployment: 'progress' })
    vi.mocked(usePipelineDetailsData).mockReturnValue({
      pipeline: null,
      loading: false,
      error: null,
      isNotFound: false,
      refetch: mockRefetch,
      setPipeline: mockSetPipeline,
    })

    render(<PipelineDetailsClientWrapper pipelineId={pipelineId} />)

    fireEvent.click(screen.getByTestId('deploy-failed'))

    expect(mockPush).toHaveBeenCalledWith('/pipelines')
  })
})
