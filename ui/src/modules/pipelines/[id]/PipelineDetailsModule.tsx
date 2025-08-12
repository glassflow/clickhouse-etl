'use client'

import { useState, useEffect } from 'react'
import PipelineDetailsHeader from './PipelineDetailsHeader'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TitleCardWithIcon from './TitleCardWithIcon'
import TransformationSection from './TransformationSection'
import StandaloneStepRenderer from '@/src/modules/pipelines/[id]/StandaloneStepRenderer'
import SectionCard from '@/src/components/SectionCard'
import { StepKeys } from '@/src/config/constants'
import { Pipeline, detectTransformationType } from '@/src/types/pipeline'
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
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { getPipeline } from '@/src/api/pipeline-api'
import { cn } from '@/src/utils/common.client'

function PipelineDetailsModule({ pipeline: initialPipeline }: { pipeline: Pipeline }) {
  const router = useRouter()

  // local copy of the pipeline data - this is used to display the pipeline data in the UI along with its status
  const [pipeline, setPipeline] = useState<Pipeline>(initialPipeline)

  // active step - determines which step is currently being rendered in the standalone step renderer
  const [activeStep, setActiveStep] = useState<StepKeys | null>(null)

  // Use the centralized pipeline actions hook to get current pipeline actions status and transitions
  const { actionState } = usePipelineActions(pipeline)

  // Get validation states from stores to display in the UI - these are used to disable the UI when the pipeline is not valid
  const kafkaValidation = useStore((state) => state.kafkaStore.validation)
  const clickhouseConnectionValidation = useStore((state) => state.clickhouseConnectionStore.validation)
  const clickhouseDestinationValidation = useStore((state) => state.clickhouseDestinationStore.validation)
  const joinValidation = useStore((state) => state.joinStore.validation)
  const topicsValidation = useStore((state) => state.topicsStore.validation)
  const deduplicationValidation = useStore((state) => state.deduplicationStore.validation)

  const { coreStore } = useStore()
  const { enterViewMode, hydrateFromConfig, mode } = coreStore

  // Determine if pipeline editing operations should be disabled
  // Consider both pipeline status AND if any action is currently loading
  const isEditingDisabled = shouldDisablePipelineOperation(pipeline.status) || actionState.isLoading

  // Function to refresh pipeline data from the server
  const refreshPipelineData = async () => {
    try {
      const updatedPipeline = await getPipeline(pipeline.pipeline_id)
      setPipeline(updatedPipeline)
    } catch (error) {
      console.error('Failed to refresh pipeline data:', error)
    }
  }

  // Hydrate the pipeline data when the pipeline configuration is loaded - copy pipeline data to stores
  // this does not connect to external services, it just copies the data to the stores
  useEffect(() => {
    if (pipeline && pipeline?.source && pipeline?.sink && actionState.isLoading === false && mode !== 'edit') {
      enterViewMode(pipeline)
    }
  }, [pipeline, enterViewMode, mode, actionState.isLoading, actionState.lastAction])

  // Refresh pipeline data after actions complete
  useEffect(() => {
    if (!actionState.isLoading && actionState.lastAction) {
      // Add a small delay to ensure the server has processed the action
      const timer = setTimeout(() => {
        refreshPipelineData()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [actionState.isLoading, actionState.lastAction, pipeline.pipeline_id])

  // set active step so that the standalone step renderer can be rendered
  const handleStepClick = (step: StepKeys) => {
    // Prevent step clicks when editing is disabled
    if (isEditingDisabled) {
      return
    }

    setActiveStep(step)
  }

  // close the standalone step renderer
  const handleCloseStep = () => {
    setActiveStep(null)
  }

  // update the local copy of the pipeline data when the pipeline is updated
  const handlePipelineUpdate = (updatedPipeline: Pipeline) => {
    setPipeline(updatedPipeline)
  }

  // redirect to pipelines list after deletion
  const handlePipelineDeleted = () => {
    // Redirect to pipelines list after deletion
    router.push('/pipelines')
  }

  // NOTE: this is used to update the pipeline status in the UI when the pipeline is paused or resumed
  // it happens when pp is active and we want to edit one of the sections - for that we need to update the status
  // in the UI so that the pipeline actions hook can determine if the pipeline is valid
  const handlePipelineStatusUpdate = (status: string) => {
    setPipeline((prev) => ({
      ...prev,
      status: status as Pipeline['status'],
    }))
  }

  // Compute transformation label using hydrated store first, fallback to raw pipeline
  const getTransformationLabel = () => {
    try {
      const store = useStore.getState()
      const joinEnabled = Boolean(
        (store.joinStore?.enabled && (store.joinStore.streams?.length || 0) > 0) ||
          (pipeline?.join?.enabled && (pipeline?.join?.sources?.length || 0) > 0),
      )

      const dedup0 = store.deduplicationStore?.getDeduplication?.(0)
      const dedup1 = store.deduplicationStore?.getDeduplication?.(1)

      const topic0 = pipeline?.source?.topics?.[0]
      const topic1 = pipeline?.source?.topics?.[1]

      const isDedup = (d: any, t: any) => {
        const enabled = d?.enabled === true || t?.deduplication?.enabled === true
        const key = (d?.key || t?.deduplication?.id_field || '').trim()
        return enabled && key.length > 0
      }

      const leftDedup = isDedup(dedup0, topic0)
      const rightDedup = isDedup(dedup1, topic1)

      if (joinEnabled && leftDedup && rightDedup) return 'Join & Deduplication'
      if (joinEnabled) return 'Join'

      // Fallback to raw pipeline detection for single topic cases
      return detectTransformationType(pipeline)
    } catch {
      return detectTransformationType(pipeline)
    }
  }

  // Section selection highlighting
  const SOURCE_STEPS = new Set<StepKeys>([StepKeys.KAFKA_CONNECTION])
  const TRANSFORMATION_STEPS = new Set<StepKeys>([
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.TOPIC_SELECTION_2,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
    StepKeys.JOIN_CONFIGURATOR,
    StepKeys.CLICKHOUSE_MAPPER,
  ])
  const SINK_STEPS = new Set<StepKeys>([StepKeys.CLICKHOUSE_CONNECTION])

  const isSourceSelected = activeStep ? SOURCE_STEPS.has(activeStep) : false
  const isSinkSelected = activeStep ? SINK_STEPS.has(activeStep) : false

  return (
    <div>
      <div className="flex flex-col gap-4">
        <PipelineDetailsHeader
          pipeline={pipeline}
          onPipelineUpdate={handlePipelineUpdate}
          onPipelineDeleted={handlePipelineDeleted}
        />
      </div>
      <div className="flex flex-col gap-4">
        <PipelineStatusOverviewSection pipeline={pipeline} />
      </div>
      <div className="flex flex-row gap-4 items-stretch">
        <div className="flex flex-col gap-4 w-1/5">
          {/* Source */}
          <div className="text-center">
            <span className="text-lg font-bold">Source</span>
          </div>
          <TitleCardWithIcon
            validation={kafkaValidation}
            title="Kafka"
            onClick={() => handleStepClick(StepKeys.KAFKA_CONNECTION)}
            disabled={isEditingDisabled}
            selected={isSourceSelected}
          >
            <Image src={KafkaIcon} alt="Kafka" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
        <div className="flex flex-col gap-4 w-3/5">
          {/* Transformation */}
          <div className="text-center">
            <span className="text-lg font-bold text-[var(--color-foreground-neutral-faded)]">
              Transformation: {getTransformationLabel()}
            </span>
          </div>
          <TransformationSection
            pipeline={pipeline}
            onStepClick={handleStepClick}
            disabled={isEditingDisabled}
            validation={{
              kafkaValidation: kafkaValidation,
              topicsValidation: topicsValidation,
              joinValidation: joinValidation,
              deduplicationValidation: deduplicationValidation,
              clickhouseConnectionValidation: clickhouseConnectionValidation,
              clickhouseDestinationValidation: clickhouseDestinationValidation,
            }}
            activeStep={activeStep}
          />
        </div>
        <div className="flex flex-col gap-4 w-1/5">
          {/* Sink */}
          <div className="text-center">
            <span className="text-lg font-bold">Sink</span>
          </div>
          <TitleCardWithIcon
            validation={clickhouseConnectionValidation}
            title="ClickHouse"
            onClick={() => handleStepClick(StepKeys.CLICKHOUSE_CONNECTION)}
            disabled={isEditingDisabled}
            selected={isSinkSelected}
          >
            <Image src={ClickHouseIcon} alt="ClickHouse" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
      </div>

      {/* Render the standalone step renderer when a step is active */}
      {activeStep && (
        <StandaloneStepRenderer
          stepKey={activeStep}
          onClose={handleCloseStep}
          pipeline={pipeline}
          onPipelineStatusUpdate={handlePipelineStatusUpdate}
        />
      )}
    </div>
  )
}

export default PipelineDetailsModule
