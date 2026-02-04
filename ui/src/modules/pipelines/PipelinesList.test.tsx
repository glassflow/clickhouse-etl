import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelinesList } from './PipelinesList'

const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  usePathname: () => '/pipelines',
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({
    page: { pipelines: vi.fn() },
    pipeline: {
      resumeClicked: vi.fn(),
      resumeSuccess: vi.fn(),
      resumeFailed: vi.fn(),
      deleteClicked: vi.fn(),
      deleteSuccess: vi.fn(),
      deleteFailed: vi.fn(),
      pauseClicked: vi.fn(),
      pauseSuccess: vi.fn(),
      pauseFailed: vi.fn(),
      renameClicked: vi.fn(),
      renameSuccess: vi.fn(),
      renameFailed: vi.fn(),
      editClicked: vi.fn(),
      editSuccess: vi.fn(),
      editFailed: vi.fn(),
    },
  }),
}))

vi.mock('@/src/hooks/usePlatformDetection', () => ({
  usePlatformDetection: () => ({ isDocker: false, isLocal: false }),
}))

vi.mock('@/src/hooks/usePipelineStateAdapter', () => ({
  useMultiplePipelineState: () => ({}),
  usePipelineOperations: () => ({
    reportResume: vi.fn(),
    reportStop: vi.fn(),
    reportDelete: vi.fn(),
    reportTerminate: vi.fn(),
    revertOptimisticUpdate: vi.fn(),
  }),
  usePipelineMonitoring: () => { },
}))

vi.mock('./utils/filterUrl', () => ({
  useFiltersFromUrl: () => [
    { status: [], health: [], tags: [] },
    vi.fn(),
  ],
}))

vi.mock('./hooks', () => ({
  useStopPipelineModal: () => ({
    isStopModalVisible: false,
    selectedPipeline: null,
    openStopModal: vi.fn(),
    closeStopModal: vi.fn(),
    onOk: vi.fn(),
    onCancel: vi.fn(),
  }),
  useRenamePipelineModal: () => ({
    isRenameModalVisible: false,
    selectedPipeline: null,
    openRenameModal: vi.fn(),
    closeRenameModal: vi.fn(),
    onOk: vi.fn(),
    onCancel: vi.fn(),
  }),
  useEditPipelineModal: () => ({
    isEditModalVisible: false,
    selectedPipeline: null,
    openEditModal: vi.fn(),
    closeEditModal: vi.fn(),
    onOk: vi.fn(),
    onCancel: vi.fn(),
  }),
  useTerminatePipelineModal: () => ({
    isTerminateModalVisible: false,
    selectedPipeline: null,
    openTerminateModal: vi.fn(),
    closeTerminateModal: vi.fn(),
    onOk: vi.fn(),
    onCancel: vi.fn(),
  }),
}))

vi.mock('./usePipelineListOperations', () => ({
  usePipelineListOperations: () => ({
    setPipelineLoading: vi.fn(),
    clearPipelineLoading: vi.fn(),
    isPipelineLoading: () => false,
    getPipelineOperation: () => null,
    handleStop: vi.fn(),
    handleResume: vi.fn(),
    handleEdit: vi.fn(),
    handleRename: vi.fn(),
    handleTerminate: vi.fn(),
    handleDelete: vi.fn(),
    handleDownload: vi.fn(),
    handleManageTags: vi.fn(),
    handleStopConfirm: vi.fn(),
    handleRenameConfirm: vi.fn(),
    handleEditConfirm: vi.fn(),
    handleTerminateConfirm: vi.fn(),
  }),
}))

vi.mock('./columns/pipelineListColumns', () => ({
  getPipelineListColumns: () => [],
}))

vi.mock('./PipelinesTable', () => ({
  PipelinesTable: () => <div data-testid="pipelines-table">Table</div>,
}))

vi.mock('./MobilePipelinesList', () => ({
  MobilePipelinesList: () => <div data-testid="mobile-pipelines-list">Mobile</div>,
}))

vi.mock('./components/StopPipelineModal', () => ({ default: () => null }))
vi.mock('./components/TerminatePipelineModal', () => ({ default: () => null }))
vi.mock('./components/RenamePipelineModal', () => ({ default: () => null }))
vi.mock('./components/EditPipelineModal', () => ({ default: () => null }))
vi.mock('./PipelineTagsModal', () => ({ default: () => null }))
vi.mock('./PipelineFilterMenu', () => ({ PipelineFilterMenu: () => null, FilterState: {} }))
vi.mock('./FilterChip', () => ({ FilterChip: () => null }))
vi.mock('@/src/components/icons', () => ({
  CreateIcon: () => <span>Create</span>,
  FilterIcon: () => <span>Filter</span>,
}))
vi.mock('@/src/components/common/InfoModal', () => ({
  InfoModal: () => null,
  ModalResult: {},
}))
vi.mock('@/src/api/pipeline-api', () => ({ updatePipelineMetadata: vi.fn() }))
vi.mock('@/src/notifications', () => ({ notify: vi.fn() }))
vi.mock('@/src/notifications/api-error-handler', () => ({ handleApiError: vi.fn() }))

describe('PipelinesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('renders without throwing', () => {
    expect(() =>
      render(<PipelinesList pipelines={[]} />),
    ).not.toThrow()
  })

  it('renders table and filter button when pipelines provided', () => {
    render(
      <PipelinesList
        pipelines={[
          {
            pipeline_id: 'p1',
            name: 'Test',
            transformation_type: 'Deduplication',
            created_at: '2024-01-01T00:00:00Z',
            status: 'active',
          },
        ]}
      />,
    )
    expect(screen.getByTestId('pipelines-table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
  })

  it('renders New Pipeline button', () => {
    render(<PipelinesList pipelines={[]} />)
    expect(screen.getByRole('button', { name: /new pipeline|create/i })).toBeInTheDocument()
  })
})
