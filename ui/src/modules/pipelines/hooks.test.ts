import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal, useTerminatePipelineModal } from './hooks'
import type { ListPipelineConfig } from '@/src/types/pipeline'

const mockPipeline: ListPipelineConfig = {
  pipeline_id: 'p1',
  name: 'Test Pipeline',
  transformation_type: 'Deduplication',
  created_at: '2024-01-01T00:00:00Z',
  status: 'active',
}

describe('hooks', () => {
  describe('useStopPipelineModal', () => {
    it('initial state: modal not visible, selected pipeline null', () => {
      const { result } = renderHook(() => useStopPipelineModal())
      expect(result.current.isStopModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('openStopModal(pipeline) sets visible and selected pipeline', () => {
      const { result } = renderHook(() => useStopPipelineModal())
      act(() => {
        result.current.openStopModal(mockPipeline)
      })
      expect(result.current.isStopModalVisible).toBe(true)
      expect(result.current.selectedPipeline).toEqual(mockPipeline)
    })

    it('closeStopModal clears visible and selected pipeline', () => {
      const { result } = renderHook(() => useStopPipelineModal())
      act(() => result.current.openStopModal(mockPipeline))
      act(() => result.current.closeStopModal())
      expect(result.current.isStopModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('onOk and onCancel clear modal', () => {
      const { result } = renderHook(() => useStopPipelineModal())
      act(() => result.current.openStopModal(mockPipeline))
      act(() => result.current.onOk())
      expect(result.current.isStopModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
      act(() => result.current.openStopModal(mockPipeline))
      act(() => result.current.onCancel())
      expect(result.current.isStopModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('openStopModal() with no arg sets selected to null', () => {
      const { result } = renderHook(() => useStopPipelineModal())
      act(() => result.current.openStopModal())
      expect(result.current.isStopModalVisible).toBe(true)
      expect(result.current.selectedPipeline).toBeNull()
    })
  })

  describe('useRenamePipelineModal', () => {
    it('initial state: modal not visible, selected pipeline null', () => {
      const { result } = renderHook(() => useRenamePipelineModal())
      expect(result.current.isRenameModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('openRenameModal(pipeline) sets visible and selected pipeline', () => {
      const { result } = renderHook(() => useRenamePipelineModal())
      act(() => result.current.openRenameModal(mockPipeline))
      expect(result.current.isRenameModalVisible).toBe(true)
      expect(result.current.selectedPipeline).toEqual(mockPipeline)
    })

    it('closeRenameModal clears visible and selected pipeline', () => {
      const { result } = renderHook(() => useRenamePipelineModal())
      act(() => result.current.openRenameModal(mockPipeline))
      act(() => result.current.closeRenameModal())
      expect(result.current.isRenameModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('onOk and onCancel clear modal', () => {
      const { result } = renderHook(() => useRenamePipelineModal())
      act(() => result.current.openRenameModal(mockPipeline))
      act(() => result.current.onOk())
      expect(result.current.isRenameModalVisible).toBe(false)
      act(() => result.current.openRenameModal(mockPipeline))
      act(() => result.current.onCancel())
      expect(result.current.isRenameModalVisible).toBe(false)
    })

    it('openRenameModal() with no arg sets selected to null', () => {
      const { result } = renderHook(() => useRenamePipelineModal())
      act(() => result.current.openRenameModal())
      expect(result.current.selectedPipeline).toBeNull()
    })
  })

  describe('useEditPipelineModal', () => {
    it('initial state: modal not visible, selected pipeline null', () => {
      const { result } = renderHook(() => useEditPipelineModal())
      expect(result.current.isEditModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('openEditModal(pipeline) sets visible and selected pipeline', () => {
      const { result } = renderHook(() => useEditPipelineModal())
      act(() => result.current.openEditModal(mockPipeline))
      expect(result.current.isEditModalVisible).toBe(true)
      expect(result.current.selectedPipeline).toEqual(mockPipeline)
    })

    it('closeEditModal clears visible and selected pipeline', () => {
      const { result } = renderHook(() => useEditPipelineModal())
      act(() => result.current.openEditModal(mockPipeline))
      act(() => result.current.closeEditModal())
      expect(result.current.isEditModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('onOk and onCancel clear modal', () => {
      const { result } = renderHook(() => useEditPipelineModal())
      act(() => result.current.openEditModal(mockPipeline))
      act(() => result.current.onOk())
      expect(result.current.isEditModalVisible).toBe(false)
      act(() => result.current.openEditModal(mockPipeline))
      act(() => result.current.onCancel())
      expect(result.current.isEditModalVisible).toBe(false)
    })

    it('openEditModal() with no arg sets selected to null', () => {
      const { result } = renderHook(() => useEditPipelineModal())
      act(() => result.current.openEditModal())
      expect(result.current.selectedPipeline).toBeNull()
    })
  })

  describe('useTerminatePipelineModal', () => {
    it('initial state: modal not visible, selected pipeline null', () => {
      const { result } = renderHook(() => useTerminatePipelineModal())
      expect(result.current.isTerminateModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('openTerminateModal(pipeline) sets visible and selected pipeline', () => {
      const { result } = renderHook(() => useTerminatePipelineModal())
      act(() => result.current.openTerminateModal(mockPipeline))
      expect(result.current.isTerminateModalVisible).toBe(true)
      expect(result.current.selectedPipeline).toEqual(mockPipeline)
    })

    it('closeTerminateModal clears visible and selected pipeline', () => {
      const { result } = renderHook(() => useTerminatePipelineModal())
      act(() => result.current.openTerminateModal(mockPipeline))
      act(() => result.current.closeTerminateModal())
      expect(result.current.isTerminateModalVisible).toBe(false)
      expect(result.current.selectedPipeline).toBeNull()
    })

    it('onOk and onCancel clear modal', () => {
      const { result } = renderHook(() => useTerminatePipelineModal())
      act(() => result.current.openTerminateModal(mockPipeline))
      act(() => result.current.onOk())
      expect(result.current.isTerminateModalVisible).toBe(false)
      act(() => result.current.openTerminateModal(mockPipeline))
      act(() => result.current.onCancel())
      expect(result.current.isTerminateModalVisible).toBe(false)
    })

    it('openTerminateModal() with no arg sets selected to null', () => {
      const { result } = renderHook(() => useTerminatePipelineModal())
      act(() => result.current.openTerminateModal())
      expect(result.current.selectedPipeline).toBeNull()
    })
  })
})
