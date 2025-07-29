import { useState } from 'react'

export function usePausePipelineModal() {
  const [isPauseModalVisible, setIsPauseModalVisible] = useState(false)
  const openPauseModal = () => setIsPauseModalVisible(true)
  const closePauseModal = () => setIsPauseModalVisible(false)
  return {
    isPauseModalVisible,
    openPauseModal,
    closePauseModal,
    onOk: closePauseModal,
    onCancel: closePauseModal,
  }
}

export function useRenamePipelineModal() {
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openRenameModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsRenameModalVisible(true)
  }

  const closeRenameModal = () => {
    setIsRenameModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isRenameModalVisible,
    selectedPipeline,
    openRenameModal,
    closeRenameModal,
    onOk: closeRenameModal,
    onCancel: closeRenameModal,
  }
}

export function useEditPipelineModal() {
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const openEditModal = () => setIsEditModalVisible(true)
  const closeEditModal = () => setIsEditModalVisible(false)
  return {
    isEditModalVisible,
    openEditModal,
    closeEditModal,
    onOk: closeEditModal,
    onCancel: closeEditModal,
  }
}

export function useDeletePipelineModal() {
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const openDeleteModal = () => setIsDeleteModalVisible(true)
  const closeDeleteModal = () => setIsDeleteModalVisible(false)
  return {
    isDeleteModalVisible,
    openDeleteModal,
    closeDeleteModal,
    onOk: closeDeleteModal,
    onCancel: closeDeleteModal,
  }
}
