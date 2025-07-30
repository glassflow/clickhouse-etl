'use client'

import { useState, useEffect } from 'react'
import PipelineDetailsHeader from './PipelineDetailsHeader'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TitleCardWithIcon from './TitleCardWithIcon'
import TransformationSection from './TransformationSection'
import StandaloneStepRenderer from '@/src/modules/StandaloneStepRenderer'
import SectionCard from '@/src/components/SectionCard'
import { StepKeys } from '@/src/config/constants'
import { Pipeline } from '@/src/types/pipeline'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import KafkaIcon from '@/src/images/kafka.svg'
import ClickHouseIcon from '@/src/images/clickhouse.svg'
import { hydrateKafkaConnection } from '@/src/store/hydration/kafka-connection'
import { hydrateClickhouseConnection } from '@/src/store/hydration/clickhouse-connection'
import { hydrateKafkaTopics } from '@/src/store/hydration/topics'
import { hydrateClickhouseDestination } from '@/src/store/hydration/clickhouse-destination'
import { hydrateJoinConfiguration } from '@/src/store/hydration/join-configuration'
import { shouldDisablePipelineOperation } from '@/src/utils/pipeline-actions'
import { useStore } from '@/src/store'

function PipelineDetailsModule({ pipeline: initialPipeline }: { pipeline: Pipeline }) {
  const [pipeline, setPipeline] = useState<Pipeline>(initialPipeline)
  const [activeStep, setActiveStep] = useState<StepKeys | null>(null)
  const [sharedActionState, setSharedActionState] = useState<any>({ isLoading: false })
  const router = useRouter()

  // Get validation states from stores
  const kafkaValidation = useStore((state) => state.kafkaStore.validation)
  const clickhouseConnectionValidation = useStore((state) => state.clickhouseConnectionStore.validation)
  const clickhouseDestinationValidation = useStore((state) => state.clickhouseDestinationStore.validation)
  const joinValidation = useStore((state) => state.joinStore.validation)
  const topicsValidation = useStore((state) => state.topicsStore.validation)

  // Determine if pipeline editing operations should be disabled
  // Consider both pipeline status AND if any action is currently loading
  const isEditingDisabled = shouldDisablePipelineOperation(pipeline.status) || sharedActionState.isLoading

  useEffect(() => {
    if (pipeline && pipeline?.source && pipeline?.sink) {
      hydrateKafkaConnection(pipeline)
      hydrateKafkaTopics(pipeline)
      hydrateClickhouseConnection(pipeline)
      hydrateClickhouseDestination(pipeline)
      hydrateJoinConfiguration(pipeline)
    }
  }, [pipeline])

  const handleStepClick = (step: StepKeys) => {
    // Prevent step clicks when editing is disabled
    if (isEditingDisabled) {
      return
    }
    setActiveStep(step)
  }

  const handleCloseStep = () => {
    setActiveStep(null)
  }

  const handlePipelineUpdate = (updatedPipeline: Pipeline) => {
    console.log('Pipeline updated:', updatedPipeline)
    setPipeline(updatedPipeline)
  }

  const handlePipelineDeleted = () => {
    console.log('Pipeline deleted')
    // Redirect to pipelines list after deletion
    router.push('/pipelines')
  }

  const handleActionStateChange = (actionState: any) => {
    setSharedActionState(actionState)
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        <PipelineDetailsHeader
          pipeline={pipeline}
          onPipelineUpdate={handlePipelineUpdate}
          onPipelineDeleted={handlePipelineDeleted}
          onActionStateChange={handleActionStateChange}
        />
      </div>
      <div className="flex flex-col gap-4">
        <PipelineStatusOverviewSection pipeline={pipeline} />
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-4 w-1/6">
          {/* Source */}
          <div className="text-center">
            <span className="text-lg font-bold">Source</span>
          </div>
          <TitleCardWithIcon
            validation={kafkaValidation}
            title="Kafka"
            onClick={() => handleStepClick(StepKeys.KAFKA_CONNECTION)}
            disabled={isEditingDisabled}
          >
            <Image src={KafkaIcon} alt="Kafka" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
        <div className="flex flex-col gap-4 w-4/6">
          {/* Transformation */}
          <div className="text-center">
            <span className="text-lg font-bold">Transformation: {pipeline.transformationName || 'Default'}</span>
          </div>
          <TransformationSection
            pipeline={pipeline}
            onStepClick={handleStepClick}
            disabled={isEditingDisabled}
            validation={{
              kafkaValidation: kafkaValidation,
              topicsValidation: topicsValidation,
              joinValidation: joinValidation,
              clickhouseConnectionValidation: clickhouseConnectionValidation,
              clickhouseDestinationValidation: clickhouseDestinationValidation,
            }}
          />
        </div>
        <div className="flex flex-col gap-4 w-1/6">
          {/* Sink */}
          <div className="text-center">
            <span className="text-lg font-bold">Sink</span>
          </div>
          <TitleCardWithIcon
            validation={clickhouseConnectionValidation}
            title="ClickHouse"
            onClick={() => handleStepClick(StepKeys.CLICKHOUSE_CONNECTION)}
            disabled={isEditingDisabled}
          >
            <Image src={ClickHouseIcon} alt="ClickHouse" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
      </div>

      {/* Render the standalone step renderer when a step is active */}
      {activeStep && <StandaloneStepRenderer stepKey={activeStep} onClose={handleCloseStep} pipeline={pipeline} />}
    </div>
  )
}

export default PipelineDetailsModule
