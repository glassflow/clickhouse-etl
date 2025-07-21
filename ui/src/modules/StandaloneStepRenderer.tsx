'use client'

import React, { useState, useEffect } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { OperationKeys, stepsMetadata } from '@/src/config/constants'
import {
  KafkaConnector,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnector,
  ClickhouseMapper,
  TopicDeduplicationConfigurator,
} from '@/src/modules'
import { ReviewConfiguration } from '@/src/modules/review/ReviewConfiguration'
import { StepKeys } from '@/src/config/constants'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { validateStep } from '@/src/scheme/validators'
import { useStore } from '@/src/store'
import { JoinConfiguratorWrapper } from './join/JoinConfiguratorWrapper'
import { Button } from '@/src/components/ui/button'
import { StepType } from './pipelines/types'
import { JoinConfigurator } from './join/JoinConfigurator'

interface StandaloneStepRendererProps {
  stepType: StepKeys
  onClose: () => void
  pipeline?: any
}

function StandaloneStepRenderer({ stepType, onClose, pipeline }: StandaloneStepRendererProps) {
  const { kafkaStore, clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const [currentStep, setCurrentStep] = useState<StepKeys | null>(null)
  const [steps, setSteps] = useState<any>({})

  // Initialize steps based on stepType
  useEffect(() => {
    if (stepType) {
      setCurrentStep(stepType)
    }

    if (stepType === StepKeys.KAFKA_CONNECTION) {
      setSteps({
        [StepKeys.KAFKA_CONNECTION]: {
          component: KafkaConnector,
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
    } else if (stepType === StepKeys.CLICKHOUSE_CONNECTION) {
      setSteps({
        [StepKeys.CLICKHOUSE_CONNECTION]: {
          component: ClickhouseConnector,
          title: 'ClickHouse Connection',
          description: 'Configure your ClickHouse connection settings',
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
    } else if (stepType === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      setSteps({
        [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
          component: DeduplicationConfigurator,
          title: 'Deduplication',
          description: 'Configure deduplication settings',
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

  const handleComplete = () => {
    // Handle completion - could save changes, close modal, etc.
    onClose()
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="p-2">
              <ChevronLeftIcon className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{stepInfo.title}</h2>
              <p className="text-sm text-gray-600">{stepInfo.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <CurrentStepComponent
            steps={steps}
            onCompleteStep={handleNext}
            validate={async () => true} // You might want to implement proper validation
            standalone={true}
            onComplete={handleComplete}
            viewOnly={false}
          />
        </div>
      </div>
    </div>
  )
}

export default StandaloneStepRenderer
