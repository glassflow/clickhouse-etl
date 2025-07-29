import { useState } from 'react'

export function usePausePipelineModal() {
  const [isPauseModalVisible, setIsPauseModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openPauseModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsPauseModalVisible(true)
  }

  const closePauseModal = () => {
    setIsPauseModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isPauseModalVisible,
    selectedPipeline,
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
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openEditModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsEditModalVisible(true)
  }

  const closeEditModal = () => {
    setIsEditModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isEditModalVisible,
    selectedPipeline,
    openEditModal,
    closeEditModal,
    onOk: closeEditModal,
    onCancel: closeEditModal,
  }
}

export function useDeletePipelineModal() {
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openDeleteModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsDeleteModalVisible(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isDeleteModalVisible,
    selectedPipeline,
    openDeleteModal,
    closeDeleteModal,
    onOk: closeDeleteModal,
    onCancel: closeDeleteModal,
  }
}
