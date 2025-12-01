'use client'

import React, { useState, useEffect } from 'react'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
} from '@/src/modules'
import { StepKeys, OperationKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { JoinConfigurator } from '../../join/JoinConfigurator'
import StepRendererModal from './StepRendererModal'
import StepRendererPageComponent from './StepRendererPageComponent'
import { useStepDataPreloader } from '@/src/hooks/useStepDataPreloader'
import { StepDataPreloader } from '@/src/components/StepDataPreloader'
import { useEditConfirmationModal } from '../hooks'
import EditConfirmationModal from '../components/EditConfirmationModal'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { usePipelineState } from '@/src/hooks/usePipelineState'
import { PipelineStatus } from '@/src/types/pipeline'
import { PipelineTransitionOverlay } from '@/src/components/common/PipelineTransitionOverlay'
import { isDemoMode } from '@/src/utils/common.client'

interface StandaloneStepRendererProps {
  stepKey: StepKeys
  onClose: () => void
  pipeline?: any
  onPipelineStatusUpdate?: (status: string) => void
  topicIndex?: number // Topic index for multi-topic deduplication (0 = left, 1 = right)
}

function StandaloneStepRenderer({ stepKey, onClose, pipeline, onPipelineStatusUpdate, topicIndex = 0 }: StandaloneStepRendererProps) {
  const { kafkaStore, clickhouseConnectionStore, clickhouseDestinationStore, coreStore } = useStore()
  const [currentStep, setCurrentStep] = useState<StepKeys | null>(null)
  const [steps, setSteps] = useState<any>({})

  // Always start in read-only mode - user must click "Edit" to enable editing
  const [editMode, setEditMode] = useState(false)

  // Track pipeline stopping transition for overlay
  const [isStoppingForEdit, setIsStoppingForEdit] = useState(false)

  const { enterEditMode, mode: globalMode } = coreStore

  // Get centralized pipeline status
  const centralizedStatus = usePipelineState(pipeline?.pipeline_id)
  // Use centralized status if available, otherwise fall back to pipeline prop
  const effectiveStatus = centralizedStatus || (pipeline?.status as PipelineStatus) || 'stopped'

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

  // Monitor pipeline status changes to detect when it has stopped after edit confirmation
  useEffect(() => {
    if (isStoppingForEdit && effectiveStatus === 'stopped') {
      // Pipeline has stopped, enable edit mode
      setEditMode(true)
      setIsStoppingForEdit(false)

      // ✅ CRITICAL FIX: Only call enterEditMode if we're not already in global edit mode
      // This prevents re-hydration which would overwrite unsaved changes from other sections
      if (globalMode !== 'edit') {
        enterEditMode(pipeline)
      }
    }
  }, [isStoppingForEdit, effectiveStatus, globalMode, enterEditMode, pipeline])

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

  // Check if demo mode is enabled
  const demoMode = isDemoMode()

  // Handle edit mode toggle with confirmation for active pipelines
  const handleToggleEditMode = () => {
    // Disable editing in demo mode
    if (demoMode) {
      return
    }

    if ((effectiveStatus === 'stopped' || effectiveStatus === 'terminated') && !editMode) {
      // For stopped/terminated pipelines, enable edit mode immediately
      setEditMode(true)

      // ✅ CRITICAL FIX: Only call enterEditMode if we're not already in global edit mode
      // This prevents re-hydration which would overwrite unsaved changes from other sections
      if (globalMode !== 'edit') {
        enterEditMode(pipeline)
      }
    } else if ((effectiveStatus === 'active' || effectiveStatus === 'paused') && !editMode) {
      // For active/paused pipelines, show confirmation modal before allowing edit
      const stepInfo = steps[stepKey]
      openEditConfirmationModal(pipeline, stepInfo)
    } else if (
      effectiveStatus === 'stopping' ||
      effectiveStatus === 'pausing' ||
      effectiveStatus === 'resuming' ||
      effectiveStatus === 'terminating'
    ) {
      // For transitional states, show warning
      console.warn('Edit mode not available while pipeline is in transitional state:', effectiveStatus)
    } else {
      // For other cases (failed, etc), allow editing
      console.warn('Edit mode requested for pipeline status:', effectiveStatus)
      if (!editMode) {
        setEditMode(true)

        // CRITICAL FIX: Only call enterEditMode if we're not already in global edit mode
        // This prevents re-hydration which would overwrite unsaved changes from other sections
        if (globalMode !== 'edit') {
          enterEditMode(pipeline)
        }
      }
    }
  }

  // Handle edit confirmation using the centralized pipeline actions
  const handleEditConfirmation = async () => {
    if (!selectedPipeline) return

    closeEditConfirmationModal()

    // Show the transition overlay
    setIsStoppingForEdit(true)

    try {
      // Use the centralized pipeline actions to stop the pipeline
      // Backend requires pipeline to be stopped before editing
      await executeAction('stop', { graceful: true })

      // Update pipeline status locally to stopped
      onPipelineStatusUpdate?.('stopped')

      // The useEffect hook monitoring effectiveStatus will handle enabling edit mode
      // when the status changes to 'stopped'
    } catch (error) {
      // Notification will be shown by the pipeline action handler
      // Hide overlay on error
      setIsStoppingForEdit(false)
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

  // Determine if this is a deduplication configurator step (standalone dedup, not topic+dedup combined)
  const isDeduplicationConfiguratorStep = stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR

  // Determine if this is a topic+deduplication combined step
  const isTopicDeduplicationStep =
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
        enableDeduplication: isTopicDeduplicationStep,
      }
    : isDeduplicationConfiguratorStep
      ? {
          ...baseProps,
          index: topicIndex, // Pass topic index for multi-topic deduplication
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

      {/* Pipeline Transition Overlay - shown during stopping transition */}
      <PipelineTransitionOverlay
        visible={isStoppingForEdit}
        title="Stopping Pipeline"
        description="The pipeline is being stopped to enable editing. Please wait while the transition completes..."
      />
    </>
  )
}

export default StandaloneStepRenderer
