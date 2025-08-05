import SingleCard from './SingleColumnCard'
import DoubleColumnCard from './DoubleColumnCard'
import { StepType } from '../types'
import { StepKeys } from '@/src/config/constants'
import SingleColumnCard from './SingleColumnCard'
import { useStore } from '@/src/store'

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
}: {
  topic: any
  hasDedup: boolean
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
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
        />

        <SingleColumnCard
          label={['Right Topic']}
          orientation="right"
          value={[rightTopic?.name || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_2)}
          disabled={disabled}
          validation={validation.topicsValidation}
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
        />

        <SingleColumnCard
          label={['Right Join Key']}
          orientation="right"
          value={[rightSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
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
        />

        <SingleColumnCard
          label={['Right Join Key']}
          orientation="right"
          value={[rightSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          validation={validation.joinValidation}
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
      />
    </div>
  )
}

function TransformationSection({
  pipeline,
  onStepClick,
  disabled,
  validation,
}: {
  pipeline: any
  onStepClick: (step: StepKeys) => void
  disabled: boolean
  validation: any
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
  const hasJoin = joinStore.enabled || pipeline?.join?.enabled || false

  // Get deduplication configs from deduplication store
  const { deduplicationStore } = useStore()
  const leftTopicDeduplication = deduplicationStore.getDeduplication(0)?.enabled ?? false
  const rightTopicDeduplication = deduplicationStore.getDeduplication(1)?.enabled ?? false

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

  // Deduplication & Ingest Only case
  if (topics.length === 1 && !hasJoin) {
    const topic = topics[0]
    const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(0)
    const hasDedup = deduplicationConfig?.enabled || false

    return (
      <DeduplicationCase
        topic={topic}
        hasDedup={hasDedup}
        destinationTable={destinationTable}
        totalSourceFields={totalSourceFields}
        totalDestinationColumns={totalDestinationColumns}
        onStepClick={onStepClick}
        disabled={disabled}
        validation={validation}
      />
    )
  }

  // Join case
  if (topics.length > 1 && hasJoin && !(leftTopicDeduplication && rightTopicDeduplication)) {
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
      />
    )
  }

  // Join & Deduplication case
  if (topics.length > 1 && hasJoin && leftTopicDeduplication && rightTopicDeduplication) {
    return (
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
      />
    )
  }

  // Fallback case
  return (
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

export default TransformationSection
