import { useState } from 'react'

export function useStopPipelineModal() {
  const [isStopModalVisible, setIsStopModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openStopModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsStopModalVisible(true)
  }

  const closeStopModal = () => {
    setIsStopModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isStopModalVisible,
    selectedPipeline,
    openStopModal,
    closeStopModal,
    onOk: closeStopModal,
    onCancel: closeStopModal,
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

export function useEditConfirmationModal() {
  const [isEditConfirmationModalVisible, setIsEditConfirmationModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)
  const [selectedStep, setSelectedStep] = useState<any>(null)

  const openEditConfirmationModal = (pipeline?: any, step?: any) => {
    setSelectedPipeline(pipeline)
    setSelectedStep(step)
    setIsEditConfirmationModalVisible(true)
  }

  const closeEditConfirmationModal = () => {
    setIsEditConfirmationModalVisible(false)
    setSelectedPipeline(null)
    setSelectedStep(null)
  }

  return {
    isEditConfirmationModalVisible,
    selectedPipeline,
    selectedStep,
    openEditConfirmationModal,
    closeEditConfirmationModal,
    onOk: closeEditConfirmationModal,
    onCancel: closeEditConfirmationModal,
  }
}

export function useTerminatePipelineModal() {
  const [isTerminateModalVisible, setIsTerminateModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)

  const openTerminateModal = (pipeline?: any) => {
    setSelectedPipeline(pipeline)
    setIsTerminateModalVisible(true)
  }

  const closeTerminateModal = () => {
    setIsTerminateModalVisible(false)
    setSelectedPipeline(null)
  }

  return {
    isTerminateModalVisible,
    selectedPipeline,
    openTerminateModal,
    closeTerminateModal,
    onOk: closeTerminateModal,
    onCancel: closeTerminateModal,
  }
}
