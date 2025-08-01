'use client'

import React, { useState, useEffect } from 'react'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
  KafkaTopicSelectorSlim,
} from '@/src/modules'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { JoinConfigurator } from './join/JoinConfigurator'
import StepRendererModal from './StepRendererModal'
import StepRendererPageComponent from './StepRendererPageComponent'
import { useStepDataPreloader } from '@/src/hooks/useStepDataPreloader'
import { StepDataPreloader } from '@/src/components/StepDataPreloader'

interface StandaloneStepRendererProps {
  stepKey: StepKeys
  onClose: () => void
  pipeline?: any
}

function StandaloneStepRenderer({ stepKey, onClose, pipeline }: StandaloneStepRendererProps) {
  const { kafkaStore, clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const [currentStep, setCurrentStep] = useState<StepKeys | null>(null)
  const [steps, setSteps] = useState<any>({})
  // Always start in read-only mode - user must click "Edit" to enable editing
  const [editMode, setEditMode] = useState(false)

  // Pre-load data required for this step
  const preloader = useStepDataPreloader(stepKey, pipeline)

  // Initialize steps based on stepKey and reset edit mode when step changes
  useEffect(() => {
    if (stepKey) {
      setCurrentStep(stepKey)
      console.log('pipeline?.status', pipeline?.status)
      // Reset edit mode whenever step type changes
      setEditMode(pipeline?.status === 'active' ? false : true)
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
          component: KafkaTopicSelectorSlim,
          title: 'Kafka Topic Selection',
          description: 'Select the Kafka topic to use',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_SELECTION_2) {
      setSteps({
        [StepKeys.TOPIC_SELECTION_2]: {
          component: KafkaTopicSelectorSlim,
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
          component: KafkaTopicSelectorSlim,
          title: 'Topic Deduplication',
          description: 'Configure topic deduplication settings',
        },
      })
    } else if (stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      setSteps({
        [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
          component: KafkaTopicSelectorSlim,
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
    onComplete: handleComplete,
    readOnly: !editMode,
    toggleEditMode: () => setEditMode(!editMode),
  }

  // Additional props for topic selector components
  const topicSelectorProps = isTopicSelectorStep
    ? {
        ...baseProps,
        currentStep: stepKey,
        enableDeduplication: isDeduplicationStep,
      }
    : baseProps

  return (
    <StepRendererPageComponent stepInfo={stepInfo} handleBack={handleBack} onClose={onClose}>
      <CurrentStepComponent {...topicSelectorProps} />
    </StepRendererPageComponent>
  )
}

export default StandaloneStepRenderer
