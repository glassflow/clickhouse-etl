import { useState } from 'react'
import type { ListPipelineConfig } from '@/src/types/pipeline'

export function useStopPipelineModal() {
  const [isStopModalVisible, setIsStopModalVisible] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<ListPipelineConfig | null>(null)

  const openStopModal = (pipeline?: ListPipelineConfig | null) => {
    setSelectedPipeline(pipeline ?? null)
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
  const [selectedPipeline, setSelectedPipeline] = useState<ListPipelineConfig | null>(null)

  const openRenameModal = (pipeline?: ListPipelineConfig | null) => {
    setSelectedPipeline(pipeline ?? null)
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
  const [selectedPipeline, setSelectedPipeline] = useState<ListPipelineConfig | null>(null)

  const openEditModal = (pipeline?: ListPipelineConfig | null) => {
    setSelectedPipeline(pipeline ?? null)
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
  const [selectedPipeline, setSelectedPipeline] = useState<ListPipelineConfig | null>(null)
  const [selectedStep, setSelectedStep] = useState<{ title?: string } | null>(null)

  const openEditConfirmationModal = (pipeline?: ListPipelineConfig | null, step?: { title?: string } | null) => {
    setSelectedPipeline(pipeline ?? null)
    setSelectedStep(step ?? null)
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
  const [selectedPipeline, setSelectedPipeline] = useState<ListPipelineConfig | null>(null)

  const openTerminateModal = (pipeline?: ListPipelineConfig | null) => {
    setSelectedPipeline(pipeline ?? null)
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
