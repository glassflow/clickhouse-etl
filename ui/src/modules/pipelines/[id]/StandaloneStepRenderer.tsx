'use client'

import React, { useState, useEffect } from 'react'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
} from '@/src/modules'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { JoinConfigurator } from '../../join/JoinConfigurator'
import StepRendererModal from './StepRendererModal'
import StepRendererPageComponent from './StepRendererPageComponent'
import { useStepDataPreloader } from '@/src/hooks/useStepDataPreloader'
import { StepDataPreloader } from '@/src/components/StepDataPreloader'
import { useEditConfirmationModal } from '../hooks'
import EditConfirmationModal from '../components/EditConfirmationModal'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'

interface StandaloneStepRendererProps {
  stepKey: StepKeys
  onClose: () => void
  pipeline?: any
  onPipelineStatusUpdate?: (status: string) => void
}

function StandaloneStepRenderer({ stepKey, onClose, pipeline, onPipelineStatusUpdate }: StandaloneStepRendererProps) {
  const { kafkaStore, clickhouseConnectionStore, clickhouseDestinationStore, coreStore } = useStore()
  const [currentStep, setCurrentStep] = useState<StepKeys | null>(null)
  const [steps, setSteps] = useState<any>({})
  // TEMPORARILY DISABLED - EDIT FUNCTIONALITY DISABLED FOR DEMO
  // Always start in read-only mode - user must click "Edit" to enable editing
  const [editMode, setEditMode] = useState(false)

  const { enterEditMode } = coreStore

  // Use the centralized pipeline actions hook for state management
  const { executeAction, actionState } = usePipelineActions(pipeline)

  // Edit confirmation modal
  const {
    isEditConfirmationModalVisible,
    selectedPipeline,
    selectedStep,
    openEditConfirmationModal,
    closeEditConfirmationModal,
  } = useEditConfirmationModal()

  // Pre-load data required for this step
  const preloader = useStepDataPreloader(stepKey, pipeline)

  // Initialize steps based on stepKey and reset edit mode when step changes
  useEffect(() => {
    if (stepKey) {
      setCurrentStep(stepKey)
      // Start in read-only mode - user must explicitly click Edit to enable editing
      setEditMode(false)
    }

    if (stepKey === StepKeys.KAFKA_CONNECTION) {
      setSteps({
        [StepKeys.KAFKA_CONNECTION]: {
          component: KafkaConnectionContainer,
          title: 'Kafka Connection',
          description: 'Configure your Kafka connection settings',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_SELECTION_1) {
      setSteps({
        [StepKeys.TOPIC_SELECTION_1]: {
          component: KafkaTopicSelector,
          title: 'Kafka Topic Selection',
          description: 'Select the Kafka topic to use',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_SELECTION_2) {
      setSteps({
        [StepKeys.TOPIC_SELECTION_2]: {
          component: KafkaTopicSelector,
          title: 'Kafka Topic Selection',
          description: 'Select the Kafka topic to use',
        },
      })
    } else if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      setSteps({
        [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
          component: DeduplicationConfigurator,
          title: 'Deduplication',
          description: 'Configure deduplication settings',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      setSteps({
        [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: {
          component: KafkaTopicSelector,
          title: 'Topic Deduplication',
          description: 'Configure topic deduplication settings',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      setSteps({
        [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
          component: KafkaTopicSelector,
          title: 'Topic Deduplication',
          description: 'Configure topic deduplication settings',
        },
      })
    } else if (stepKey === StepKeys.JOIN_CONFIGURATOR) {
      setSteps({
        [StepKeys.JOIN_CONFIGURATOR]: {
          component: JoinConfigurator,
          title: 'Join Configuration',
          description: 'Configure join settings',
        },
      })
    } else if (stepKey === StepKeys.CLICKHOUSE_CONNECTION) {
      setSteps({
        [StepKeys.CLICKHOUSE_CONNECTION]: {
          component: ClickhouseConnectionContainer,
          title: 'ClickHouse Connection',
          description: 'Configure your ClickHouse connection settings',
        },
      })
    } else if (stepKey === StepKeys.CLICKHOUSE_MAPPER) {
      setSteps({
        [StepKeys.CLICKHOUSE_MAPPER]: {
          component: ClickhouseMapper,
          title: 'ClickHouse Mapping',
          description: 'Configure ClickHouse table mapping',
        },
      })
    }
  }, [stepKey])

  const handleNext = (nextStep: StepKeys) => {
    setCurrentStep(nextStep)
  }

  const handleComplete = (nextStep?: StepKeys, standalone?: boolean) => {
    // In StandaloneStepRenderer, we're always in standalone mode, so always close
    onClose()
  }

  const handleBack = () => {
    // For now, just close the step renderer
    // In the future, you could implement step navigation
    onClose()
  }

  // Handle edit mode toggle with confirmation for active pipelines
  const handleToggleEditMode = () => {
    if (pipeline?.status === 'active' && !editMode) {
      // For active pipelines, show confirmation modal before allowing edit
      const stepInfo = steps[stepKey]
      openEditConfirmationModal(pipeline, stepInfo)
    } else if ((pipeline?.status === 'paused' || pipeline?.status === 'stopped') && !editMode) {
      // For paused/stopped pipelines, enable edit mode immediately
      setEditMode(true)
      enterEditMode(pipeline)
    } else if (editMode) {
      // Toggle edit mode off - just close the modal, changes are saved in store
      setEditMode(false)
      if (onClose) {
        onClose()
      }
    }
  }

  // Handle edit confirmation using the centralized pipeline actions
  const handleEditConfirmation = async () => {
    if (!selectedPipeline) return

    closeEditConfirmationModal()

    try {
      // Use the centralized pipeline actions to stop the pipeline
      // Backend requires pipeline to be stopped before editing
      await executeAction('stop', { graceful: true })

      // Update pipeline status locally to stopped
      onPipelineStatusUpdate?.('stopped')

      // Wait a bit for the stop action to propagate
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Now enable edit mode
      setEditMode(true)
      enterEditMode(pipeline)
    } catch (error) {
      console.error('Failed to stop pipeline for editing:', error)
      // Don't enable edit mode if stop failed
    }
  }

  // Show preloader if data is still loading or if there's an error
  if (preloader.isLoading || preloader.error) {
    const stepInfo = steps[stepKey]
    return (
      <StepDataPreloader
        isLoading={preloader.isLoading}
        error={preloader.error}
        progress={preloader.progress}
        onRetry={preloader.retry}
        stepTitle={stepInfo?.title || 'Configuration Step'}
      />
    )
  }

  // Don't render the component until preloading is complete
  if (!preloader.isComplete || !stepKey || !currentStep || !steps[currentStep]) {
    return null
  }

  const CurrentStepComponent = steps[currentStep].component
  const stepInfo = steps[currentStep]

  // NOTE: uncomment this to use the modal version
  // return (
  //   <StepRendererModal stepInfo={stepInfo} handleBack={handleBack} onClose={onClose}>
  //     <CurrentStepComponent {...topicSelectorProps} />
  //   </StepRendererModal>
  // )

  // Determine if this is a deduplication configurator step
  const isDeduplicationStep =
    stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 || stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2

  // Determine if this is a topic selector step that needs currentStep prop
  const isTopicSelectorStep =
    stepKey === StepKeys.TOPIC_SELECTION_1 ||
    stepKey === StepKeys.TOPIC_SELECTION_2 ||
    stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
    stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2

  // Base props for all components
  const baseProps = {
    steps,
    onCompleteStep: handleNext,
    validate: async () => true, // You might want to implement proper validation
    standalone: true,
    onCompleteStandaloneEditing: handleComplete,
    readOnly: !editMode,
    toggleEditMode: handleToggleEditMode,
    // Pass pipeline action state for loading indicators
    pipelineActionState: actionState,
    pipeline,
  }

  // Additional props for topic selector components
  const extendedProps = isTopicSelectorStep
    ? {
        ...baseProps,
        currentStep: stepKey,
        enableDeduplication: isDeduplicationStep,
      }
    : baseProps

  return (
    <>
      <StepRendererPageComponent
        stepInfo={stepInfo}
        handleBack={handleBack}
        onClose={onClose}
        isLoading={actionState.isLoading}
        loadingText={
          actionState.lastAction === 'stop'
            ? 'Stopping pipeline for editing...'
            : actionState.lastAction === 'resume'
              ? 'Resuming pipeline...'
              : actionState.lastAction === 'delete'
                ? 'Deleting pipeline...'
                : actionState.lastAction === 'rename'
                  ? 'Renaming pipeline...'
                  : actionState.lastAction === 'edit'
                    ? 'Saving pipeline configuration...'
                    : 'Processing...'
        }
      >
        <CurrentStepComponent {...extendedProps} />
      </StepRendererPageComponent>

      {/* Edit Confirmation Modal */}
      <EditConfirmationModal
        visible={isEditConfirmationModalVisible}
        onOk={handleEditConfirmation}
        onCancel={closeEditConfirmationModal}
        stepName={selectedStep?.title}
      />
    </>
  )
}

export default StandaloneStepRenderer
