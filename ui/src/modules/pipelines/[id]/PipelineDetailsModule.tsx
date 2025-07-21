'use client'

import { useEffect, useState } from 'react'
import PipelineDetailsHeader from './PipelineDetailsHeader'
import OverviewCard from './DeadLetterQueueCard'
import TitleCardWithIcon from './TitleCardWithIcon'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TransformationSection from './TransformationSection'
import KafkaIcon from '@/src/images/kafka.svg'
import ClickHouseIcon from '@/src/images/clickhouse.svg'
import Image from 'next/image'
import StandaloneStepRenderer from '@/src/modules/StandaloneStepRenderer'
import { StepKeys } from '@/src/config/constants'
import { Pipeline } from '@/src/api/pipeline-api'
import { hydrateKafkaConnection } from '@/src/store/hydration/kafka-connection'
import { hydrateClickhouseConnection } from '@/src/store/hydration/clickhouse-connection'

function PipelineDetailsModule({ pipeline }: { pipeline: Pipeline }) {
  const [activeStep, setActiveStep] = useState<StepKeys | null>(null)

  useEffect(() => {
    if (pipeline && pipeline?.source && pipeline?.sink) {
      hydrateKafkaConnection(pipeline)
      hydrateClickhouseConnection(pipeline)
    }
  }, [pipeline])

  const handleStepClick = (step: StepKeys) => {
    setActiveStep(step)
  }

  const handleCloseStep = () => {
    setActiveStep(null)
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        <PipelineDetailsHeader title={pipeline.name} status={pipeline.status} actions={pipeline.actions} />
      </div>
      <div className="flex flex-col gap-4">
        <PipelineStatusOverviewSection />
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-4 w-1/6">
          {/* Source */}
          <div className="text-center">
            <span className="text-lg font-bold">Source</span>
          </div>
          <TitleCardWithIcon
            title="Kafka"
            isClickable={true}
            onClick={() => handleStepClick(StepKeys.KAFKA_CONNECTION)}
          >
            <Image src={KafkaIcon} alt="Kafka" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
        <div className="flex flex-col gap-4 w-4/6">
          {/* Transformation */}
          <div className="text-center">
            <span className="text-lg font-bold">Transformation: {pipeline.transformationName || 'Default'}</span>
          </div>
          <TransformationSection pipeline={pipeline} onStepClick={handleStepClick} />
        </div>
        <div className="flex flex-col gap-4 w-1/6">
          {/* Sink */}
          <div className="text-center">
            <span className="text-lg font-bold">Sink</span>
          </div>
          <TitleCardWithIcon
            title="ClickHouse"
            isClickable={true}
            onClick={() => handleStepClick(StepKeys.CLICKHOUSE_CONNECTION)}
          >
            <Image src={ClickHouseIcon} alt="ClickHouse" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
      </div>

      {/* Render the standalone step renderer when a step is active */}
      {activeStep && <StandaloneStepRenderer stepType={activeStep} onClose={handleCloseStep} pipeline={pipeline} />}
    </div>
  )
}

export default PipelineDetailsModule
