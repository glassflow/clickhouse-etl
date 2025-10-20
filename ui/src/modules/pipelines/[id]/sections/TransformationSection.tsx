import SingleCard from '../SingleColumnCard'
import DoubleColumnCard from '../DoubleColumnCard'
import { StepType } from '../../types'
import { StepKeys } from '@/src/config/constants'
import SingleColumnCard from '../SingleColumnCard'
import { useStore } from '@/src/store'
import { detectTransformationType } from '@/src/types/pipeline'

// covers the case where there is a single topic and no join for deduplication or ingest only
const DeduplicationCase = ({
  topic,
  hasDedup,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick: onStepClick,
  disabled,
  validation,
  activeStep,
}: {
  topic: any
  hasDedup: boolean
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Top card: Topic */}
      <SingleCard
        label={['Topic']}
        value={[topic.name]}
        orientation="center"
        width="full"
        onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_1)}
        disabled={disabled}
        validation={validation}
        selected={activeStep === StepKeys.TOPIC_SELECTION_1}
      />

      {/* Middle card: Deduplication Key (only if dedup is enabled) */}
      {hasDedup &&
        (() => {
          const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(0)
          return (
            <SingleCard
              label={['Deduplication Key']}
              value={[deduplicationConfig?.key || 'N/A']}
              orientation="center"
              width="full"
              onClick={() => onStepClick(StepKeys.DEDUPLICATION_CONFIGURATOR)}
              disabled={disabled}
              validation={validation.deduplicationValidation}
              selected={activeStep === StepKeys.DEDUPLICATION_CONFIGURATOR}
            />
          )
        })()}

      {/* Bottom card: Destination Table and Schema Mapping */}
      <DoubleColumnCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
        onClick={() => onStepClick(StepKeys.CLICKHOUSE_MAPPER)}
        disabled={disabled}
        validation={validation}
        selected={activeStep === StepKeys.CLICKHOUSE_MAPPER}
      />
    </div>
  )
}

const JoinCase = ({
  leftTopic,
  rightTopic,
  leftSource,
  rightSource,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick,
  disabled,
  validation,
  activeStep,
}: {
  leftTopic: any
  rightTopic: any
  leftSource: any
  rightSource: any
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Topics - Left and Right */}
      <div className="flex flex-row gap-4">
        <SingleColumnCard
          label={['Left Topic']}
          orientation="left"
          value={[leftTopic?.name || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_1)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_SELECTION_1}
        />

        <SingleColumnCard
          label={['Right Topic']}
          orientation="right"
          value={[rightTopic?.name || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_2)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_SELECTION_2}
        />
      </div>

      {/* Join Keys - Left and Right */}
      <div className="flex flex-row gap-4">
        <SingleColumnCard
          label={['Left Join Key']}
          orientation="left"
          value={[leftSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />

        <SingleColumnCard
          label={['Right Join Key']}
          orientation="right"
          value={[rightSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />
      </div>

      {/* Destination Table and Schema Mapping */}
      <DoubleColumnCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
        onClick={() => onStepClick(StepKeys.CLICKHOUSE_MAPPER)}
        disabled={disabled}
        validation={validation}
        selected={activeStep === StepKeys.CLICKHOUSE_MAPPER}
      />
    </div>
  )
}

const JoinDeduplicationCase = ({
  leftTopic,
  rightTopic,
  leftSource,
  rightSource,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick,
  disabled,
  validation,
  activeStep,
}: {
  leftTopic: any
  rightTopic: any
  leftSource: any
  rightSource: any
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Topics with Dedup Keys - Left and Right */}
      <div className="flex flex-row gap-4">
        <DoubleColumnCard
          label={['Left Topic', 'Dedup Key']}
          value={[
            leftTopic?.name || 'N/A',
            (() => {
              const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(0)
              return deduplicationConfig?.enabled ? deduplicationConfig.key : 'None'
            })(),
          ]}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1}
        />

        <DoubleColumnCard
          label={['Dedup Key', 'Right Topic']}
          value={[
            (() => {
              const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(1)
              return deduplicationConfig?.enabled ? deduplicationConfig.key : 'None'
            })(),
            rightTopic?.name || 'N/A',
          ]}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2}
        />
      </div>

      {/* Join Keys - Left and Right */}
      <div className="flex flex-row gap-4">
        <SingleColumnCard
          label={['Left Join Key']}
          orientation="left"
          value={[leftSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          validation={validation.joinValidation}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />

        <SingleColumnCard
          label={['Right Join Key']}
          orientation="right"
          value={[rightSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          validation={validation.joinValidation}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />
      </div>

      {/* Destination Table and Schema Mapping */}
      <DoubleColumnCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
        onClick={() => onStepClick(StepKeys.CLICKHOUSE_MAPPER)}
        disabled={disabled}
        validation={validation.clickhouseDestinationValidation}
        selected={activeStep === StepKeys.CLICKHOUSE_MAPPER}
      />
    </div>
  )
}

function TransformationSection({
  pipeline,
  onStepClick,
  disabled,
  validation,
  activeStep,
}: {
  pipeline: any
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) {
  // Get fresh data from store instead of stale pipeline config
  const { topicsStore, joinStore, clickhouseDestinationStore } = useStore()

  // Extract topics from store (fresh data) - convert to array format like pipeline config
  const storeTopics = Object.values(topicsStore.topics).map((topic: any) => ({
    name: topic.name,
    deduplication: {
      enabled: false, // Will be handled by deduplicationStore
    },
  }))

  // Fallback to pipeline config if store is empty (e.g., when viewing existing pipeline)
  const topics = storeTopics.length > 0 ? storeTopics : pipeline?.source?.topics || []

  // Robust join detection: require enabled and at least one source/stream
  const hasJoin = Boolean(
    (joinStore.enabled && (joinStore.streams?.length || 0) > 0) ||
      (pipeline?.join?.enabled && (pipeline?.join?.sources?.length || 0) > 0),
  )

  // Get deduplication configs from store and pipeline for strict checks
  const { deduplicationStore } = useStore()
  const dedup0 = deduplicationStore.getDeduplication(0)
  const dedup1 = deduplicationStore.getDeduplication(1)
  const topic0 = topics[0]
  const topic1 = topics[1]

  const isDedup = (d: any, t: any) => {
    const enabled = d?.enabled === true || t?.deduplication?.enabled === true
    const key = (d?.key || t?.deduplication?.id_field || '').trim()
    return enabled && key.length > 0
  }

  const leftTopicDeduplication = isDedup(dedup0, topic0)
  const rightTopicDeduplication = isDedup(dedup1, topic1)

  // Convert join streams to pipeline config format
  const storeJoinSources =
    joinStore.streams.map((stream: any) => ({
      source_id: stream.topicName,
      join_key: stream.joinKey,
      orientation: stream.orientation,
    })) || []

  // Fallback to pipeline config if store is empty
  const joinSources = storeJoinSources.length > 0 ? storeJoinSources : pipeline?.join?.sources || []

  // Get destination table info from store
  const storeDestinationTable = clickhouseDestinationStore.clickhouseDestination.table
  const storeTableMapping = clickhouseDestinationStore.clickhouseDestination.mapping || []

  // Fallback to pipeline config if store is empty
  const destinationTable = storeDestinationTable || pipeline?.sink?.table || 'N/A'
  const tableMapping = storeTableMapping.length > 0 ? storeTableMapping : pipeline?.sink?.table_mapping || []
  const totalSourceFields = tableMapping.length
  const totalDestinationColumns = tableMapping.length

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

  let sectionContent = null

  // Deduplication & Ingest Only case
  if (topics.length === 1 && !hasJoin) {
    const topic = topics[0]
    const hasDedup = isDedup(dedup0, topic)

    sectionContent = (
      <DeduplicationCase
        topic={topic}
        hasDedup={hasDedup}
        destinationTable={destinationTable}
        totalSourceFields={totalSourceFields}
        totalDestinationColumns={totalDestinationColumns}
        onStepClick={onStepClick}
        disabled={disabled}
        validation={validation}
        activeStep={activeStep}
      />
    )
  }
  // Join case
  else if (topics.length > 1 && hasJoin && !(leftTopicDeduplication && rightTopicDeduplication)) {
    const leftSource = joinSources.find((s: any) => s.orientation === 'left')
    const rightSource = joinSources.find((s: any) => s.orientation === 'right')

    const leftTopic = topics.find((t: any) => t.name === leftSource?.source_id)
    const rightTopic = topics.find((t: any) => t.name === rightSource?.source_id)

    return (
      <JoinCase
        leftTopic={leftTopic}
        rightTopic={rightTopic}
        leftSource={leftSource}
        rightSource={rightSource}
        destinationTable={destinationTable}
        totalSourceFields={totalSourceFields}
        totalDestinationColumns={totalDestinationColumns}
        onStepClick={onStepClick}
        disabled={disabled}
        validation={validation}
        activeStep={activeStep}
      />
    )
  }

  // Join & Deduplication case
  else if (topics.length > 1 && hasJoin && leftTopicDeduplication && rightTopicDeduplication) {
    sectionContent = (
      <JoinDeduplicationCase
        leftTopic={topics[0]}
        rightTopic={topics[1]}
        leftSource={joinSources.find((s: any) => s.orientation === 'left')}
        rightSource={joinSources.find((s: any) => s.orientation === 'right')}
        destinationTable={destinationTable}
        totalSourceFields={totalSourceFields}
        totalDestinationColumns={totalDestinationColumns}
        onStepClick={onStepClick}
        disabled={disabled}
        validation={validation}
        activeStep={activeStep}
      />
    )
  }

  // Fallback case
  else {
    sectionContent = (
      <div className="flex flex-col gap-4">
        <SingleCard
          label={['Configuration']}
          value={[`${topics.length} topic(s), Join: ${hasJoin ? 'Yes' : 'No'}`]}
          orientation="center"
          width="full"
          disabled={disabled}
        />
        <DoubleColumnCard
          label={['Destination Table', 'Schema Mapping']}
          value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
          width="full"
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-3/5">
      {/* Transformation */}
      <div className="text-center">
        <span className="text-lg font-bold text-[var(--color-foreground-neutral-faded)]">
          Transformation: {getTransformationLabel()}
        </span>
      </div>
      {sectionContent}
    </div>
  )
}

export default TransformationSection
