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
              validation={validation}
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
          validation={validation}
        />

        <SingleColumnCard
          label={['Right Topic']}
          orientation="right"
          value={[rightTopic?.name || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_2)}
          disabled={disabled}
          validation={validation}
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
  const { source, join, sink } = pipeline

  // Extract topics from source
  const topics = source?.topics || []
  const hasJoin = join?.enabled || false
  const leftTopicDeduplication = source?.topics[0]?.deduplication?.enabled ?? false
  const rightTopicDeduplication = source?.topics[1]?.deduplication?.enabled ?? false
  const joinSources = join?.sources || []

  // Get destination table info
  const destinationTable = sink?.table || 'N/A'
  const tableMapping = sink?.table_mapping || []
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
        validation={validation.topicsValidation}
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
        validation={validation.joinValidation}
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
        validation={{
          topicsValidation: validation.topicsValidation,
          joinValidation: validation.joinValidation,
        }}
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
