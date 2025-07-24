'use client'

import React, { useState, useEffect } from 'react'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
  TopicDeduplicationConfigurator,
} from '@/src/modules'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { JoinConfigurator } from './join/JoinConfigurator'
import StepRendererModal from './StepRendererModal'
import StepRendererPageComponent from './StepRendererPageComponent'

interface StandaloneStepRendererProps {
  stepType: StepKeys
  onClose: () => void
  pipeline?: any
}

function StandaloneStepRenderer({ stepType, onClose, pipeline }: StandaloneStepRendererProps) {
  const { kafkaStore, clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const [currentStep, setCurrentStep] = useState<StepKeys | null>(null)
  const [steps, setSteps] = useState<any>({})
  const [editMode, setEditMode] = useState(false)

  // Initialize steps based on stepType
  useEffect(() => {
    if (stepType) {
      setCurrentStep(stepType)
    }

    if (stepType === StepKeys.KAFKA_CONNECTION) {
      setSteps({
        [StepKeys.KAFKA_CONNECTION]: {
          component: KafkaConnectionContainer,
          title: 'Kafka Connection',
          description: 'Configure your Kafka connection settings',
        },
      })
    } else if (stepType === StepKeys.TOPIC_SELECTION_1) {
      setSteps({
        [StepKeys.TOPIC_SELECTION_1]: {
          component: KafkaTopicSelector,
          title: 'Kafka Topic Selection',
          description: 'Select the Kafka topic to use',
        },
      })
    } else if (stepType === StepKeys.TOPIC_SELECTION_2) {
      setSteps({
        [StepKeys.TOPIC_SELECTION_2]: {
          component: KafkaTopicSelector,
          title: 'Kafka Topic Selection',
          description: 'Select the Kafka topic to use',
        },
      })
    } else if (stepType === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      setSteps({
        [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
          component: DeduplicationConfigurator,
          title: 'Deduplication',
          description: 'Configure deduplication settings',
        },
      })
    } else if (stepType === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      setSteps({
        [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: {
          component: TopicDeduplicationConfigurator,
          title: 'Topic Deduplication',
          description: 'Configure topic deduplication settings',
        },
      })
    } else if (stepType === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      setSteps({
        [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
          component: TopicDeduplicationConfigurator,
          title: 'Topic Deduplication',
          description: 'Configure topic deduplication settings',
        },
      })
    } else if (stepType === StepKeys.JOIN_CONFIGURATOR) {
      setSteps({
        [StepKeys.JOIN_CONFIGURATOR]: {
          component: JoinConfigurator,
          title: 'Join Configuration',
          description: 'Configure join settings',
        },
      })
    } else if (stepType === StepKeys.CLICKHOUSE_CONNECTION) {
      setSteps({
        [StepKeys.CLICKHOUSE_CONNECTION]: {
          component: ClickhouseConnectionContainer,
          title: 'ClickHouse Connection',
          description: 'Configure your ClickHouse connection settings',
        },
      })
    } else if (stepType === StepKeys.CLICKHOUSE_MAPPER) {
      setSteps({
        [StepKeys.CLICKHOUSE_MAPPER]: {
          component: ClickhouseMapper,
          title: 'ClickHouse Mapping',
          description: 'Configure ClickHouse table mapping',
        },
      })
    }
  }, [stepType])

  const handleNext = (nextStep: StepKeys) => {
    setCurrentStep(nextStep)
  }

  const handleComplete = (nextStep?: StepKeys, standalone?: boolean) => {
    // Handle completion - could save changes, close modal, etc.
    if (standalone) {
      onClose()
    } else {
      handleNext(nextStep || StepKeys.KAFKA_CONNECTION)
    }
  }

  const handleBack = () => {
    // For now, just close the step renderer
    // In the future, you could implement step navigation
    onClose()
  }

  if (!stepType || !currentStep || !steps[currentStep]) {
    return null
  }

  const CurrentStepComponent = steps[currentStep].component
  const stepInfo = steps[currentStep]

  // NOTE: uncomment this to use the modal version
  // return (
  //   <StepRendererModal stepInfo={stepInfo} handleBack={handleBack} onClose={onClose}>
  //     <CurrentStepComponent
  //       steps={steps}
  //       onCompleteStep={handleNext}
  //       validate={async () => true} // You might want to implement proper validation
  //       standalone={true}
  //       onComplete={handleComplete}
  //       readOnly={false}
  //     />
  //   </StepRendererModal>
  // )

  return (
    <StepRendererPageComponent stepInfo={stepInfo} handleBack={handleBack} onClose={onClose}>
      <CurrentStepComponent
        steps={steps}
        onCompleteStep={handleNext}
        validate={async () => true} // You might want to implement proper validation
        standalone={true}
        onComplete={handleComplete}
        readOnly={!editMode}
        toggleEditMode={() => setEditMode(!editMode)}
      />
    </StepRendererPageComponent>
  )
}

export default StandaloneStepRenderer
