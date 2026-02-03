import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePipelineListOperations } from './usePipelineListOperations'
import type { ListPipelineConfig } from '@/src/types/pipeline'

const mockResumePipeline = vi.fn()
const mockStopPipeline = vi.fn()
const mockDeletePipeline = vi.fn()
const mockRenamePipeline = vi.fn()
const mockTerminatePipeline = vi.fn()

vi.mock('@/src/api/pipeline-api', () => ({
  resumePipeline: (id: string) => mockResumePipeline(id),
  stopPipeline: (id: string) => mockStopPipeline(id),
  deletePipeline: (id: string) => mockDeletePipeline(id),
  renamePipeline: (id: string, name: string) => mockRenamePipeline(id, name),
  terminatePipeline: (id: string) => mockTerminatePipeline(id),
  updatePipelineMetadata: vi.fn(),
}))

vi.mock('@/src/utils/pipeline-download', () => ({
  downloadPipelineConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/notifications', () => ({
  notify: vi.fn(),
}))

vi.mock('@/src/notifications/api-error-handler', () => ({
  handleApiError: vi.fn(),
}))

const mockPipeline: ListPipelineConfig = {
  pipeline_id: 'p1',
  name: 'Test Pipeline',
  transformation_type: 'Deduplication',
  created_at: '2024-01-01T00:00:00Z',
  status: 'active',
}

function getProps() {
  const openStopModal = vi.fn()
  const openRenameModal = vi.fn()
  const openEditModal = vi.fn()
  const openTerminateModal = vi.fn()
  const onOpenTagsModal = vi.fn()
  const router = { push: vi.fn() }
  const operations = {
    reportResume: vi.fn(),
    reportStop: vi.fn(),
    reportDelete: vi.fn(),
    reportTerminate: vi.fn(),
    revertOptimisticUpdate: vi.fn(),
  }
  const analytics = {
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
  }
  const getEffectiveStatus = vi.fn((p: ListPipelineConfig) => (p.status as string) ?? 'active')

  return {
    operations,
    analytics,
    router,
    getEffectiveStatus,
    onUpdatePipelineStatus: undefined,
    onUpdatePipelineName: vi.fn(),
    onRemovePipeline: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
    openStopModal,
    openRenameModal,
    openEditModal,
    openTerminateModal,
    onOpenTagsModal,
  }
}

describe('usePipelineListOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResumePipeline.mockResolvedValue(undefined)
    mockStopPipeline.mockResolvedValue(undefined)
    mockDeletePipeline.mockResolvedValue(undefined)
    mockRenamePipeline.mockResolvedValue(undefined)
    mockTerminatePipeline.mockResolvedValue(undefined)
  })

  describe('loading state', () => {
    it('setPipelineLoading and clearPipelineLoading update isPipelineLoading and getPipelineOperation', () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))

      expect(result.current.isPipelineLoading('p1')).toBe(false)
      expect(result.current.getPipelineOperation('p1')).toBeNull()

      act(() => {
        result.current.setPipelineLoading('p1', 'resume')
      })
      expect(result.current.isPipelineLoading('p1')).toBe(true)
      expect(result.current.getPipelineOperation('p1')).toBe('resume')

      act(() => {
        result.current.clearPipelineLoading('p1')
      })
      expect(result.current.isPipelineLoading('p1')).toBe(false)
      expect(result.current.getPipelineOperation('p1')).toBeNull()
    })
  })

  describe('handlers call modal openers', () => {
    it('handleStop calls openStopModal', () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleStop(mockPipeline))
      expect(props.openStopModal).toHaveBeenCalledWith(mockPipeline)
    })

    it('handleRename calls openRenameModal', () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleRename(mockPipeline))
      expect(props.openRenameModal).toHaveBeenCalledWith(mockPipeline)
    })

    it('handleTerminate calls openTerminateModal', () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleTerminate(mockPipeline))
      expect(props.openTerminateModal).toHaveBeenCalledWith(mockPipeline)
    })

    it('handleManageTags calls onOpenTagsModal', () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleManageTags(mockPipeline))
      expect(props.onOpenTagsModal).toHaveBeenCalledWith(mockPipeline)
    })
  })

  describe('handleEdit', () => {
    it('when effectiveStatus is active, calls openEditModal', () => {
      const props = getProps()
      props.getEffectiveStatus.mockReturnValue('active')
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleEdit(mockPipeline))
      expect(props.openEditModal).toHaveBeenCalledWith(mockPipeline)
      expect(props.router.push).not.toHaveBeenCalled()
    })

    it('when effectiveStatus is not active, calls router.push', () => {
      const props = getProps()
      props.getEffectiveStatus.mockReturnValue('paused')
      const { result } = renderHook(() => usePipelineListOperations(props))
      act(() => result.current.handleEdit(mockPipeline))
      expect(props.openEditModal).not.toHaveBeenCalled()
      expect(props.router.push).toHaveBeenCalledWith('/pipelines/p1')
    })
  })

  describe('handleResume', () => {
    it('on API success clears loading and calls operations.reportResume', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleResume(mockPipeline)
      })
      expect(props.operations.reportResume).toHaveBeenCalledWith('p1')
      expect(mockResumePipeline).toHaveBeenCalledWith('p1')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })

  describe('handleStopConfirm', () => {
    it('on API success calls stopPipeline and clears loading', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleStopConfirm(mockPipeline)
      })
      expect(props.operations.reportStop).toHaveBeenCalledWith('p1')
      expect(mockStopPipeline).toHaveBeenCalledWith('p1')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })

  describe('handleRenameConfirm', () => {
    it('on API success calls renamePipeline and clears loading', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleRenameConfirm(mockPipeline, 'New Name')
      })
      expect(mockRenamePipeline).toHaveBeenCalledWith('p1', 'New Name')
      expect(props.onUpdatePipelineName).toHaveBeenCalledWith('p1', 'New Name')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })

  describe('handleEditConfirm', () => {
    it('on API success calls stopPipeline then router.push and clears loading', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleEditConfirm(mockPipeline)
      })
      expect(props.operations.reportStop).toHaveBeenCalledWith('p1')
      expect(mockStopPipeline).toHaveBeenCalledWith('p1')
      expect(props.router.push).toHaveBeenCalledWith('/pipelines/p1')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })

  describe('handleTerminateConfirm', () => {
    it('on API success calls terminatePipeline and clears loading', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleTerminateConfirm(mockPipeline)
      })
      expect(props.operations.reportTerminate).toHaveBeenCalledWith('p1')
      expect(mockTerminatePipeline).toHaveBeenCalledWith('p1')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })

  describe('handleDelete', () => {
    it('on API success calls deletePipeline, onRemovePipeline and clears loading', async () => {
      const props = getProps()
      const { result } = renderHook(() => usePipelineListOperations(props))
      await act(async () => {
        result.current.handleDelete(mockPipeline)
      })
      expect(props.operations.reportDelete).toHaveBeenCalledWith('p1')
      expect(mockDeletePipeline).toHaveBeenCalledWith('p1')
      expect(props.onRemovePipeline).toHaveBeenCalledWith('p1')
      expect(result.current.isPipelineLoading('p1')).toBe(false)
    })
  })
})
