import SingleCard from '../SingleColumnCard'
import DoubleColumnCard from '../DoubleColumnCard'
import { StepType } from '../../types'
import { StepKeys } from '@/src/config/constants'
import SingleColumnCard from '../SingleColumnCard'
import { useStore } from '@/src/store'
import { detectTransformationType } from '@/src/types/pipeline'
import { countRulesInGroup } from '@/src/modules/filter/utils'
import { isFiltersEnabled } from '@/src/config/feature-flags'
import { getIntermediarySchema } from '@/src/modules/transformation/utils'

// Filter card component to display filter configuration
const FilterCard = ({
  onStepClick,
  disabled,
  validation,
  activeStep,
}: {
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) => {
  const { filterStore } = useStore()
  const filterConfig = filterStore.filterConfig
  const expressionString = filterStore.expressionString

  // Count rules in the tree structure
  const ruleCount = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0

  // Determine if filter is configured (either has rules in tree or has expression string from hydration)
  const hasFilter = (filterConfig.enabled && ruleCount > 0) || (filterConfig.enabled && expressionString)

  // Determine the display value
  let displayValue: string
  if (hasFilter) {
    if (ruleCount > 0) {
      const ruleLabel = ruleCount === 1 ? '1 rule' : `${ruleCount} rules`
      const combinator = filterConfig.root?.combinator || 'and'
      displayValue = `${ruleLabel} (${combinator.toUpperCase()})`
    } else if (expressionString) {
      // Filter was hydrated from expression string but tree not reconstructed
      displayValue = 'Expression configured'
    } else {
      displayValue = 'Configured'
    }
  } else {
    displayValue = 'No filter configured'
  }

  return (
    <SingleCard
      label={['Filter']}
      value={[displayValue]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.FILTER_CONFIGURATOR)}
      disabled={disabled}
      validation={validation?.filterValidation}
      selected={activeStep === StepKeys.FILTER_CONFIGURATOR}
    />
  )
}

// Type Verification card component to display Kafka event field types
const TypeVerificationCard = ({
  onStepClick,
  disabled,
  activeStep,
  topicIndex = 0,
  label = 'Verify Field Types',
}: {
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  activeStep: StepKeys | null
  topicIndex?: number
  label?: string
}) => {
  const { topicsStore } = useStore()
  const topic = topicsStore.getTopic(topicIndex)

  // Get schema from topic if available
  const schema = (topic as any)?.schema?.fields || []
  const fieldCount = schema.length

  // Determine display value
  let displayValue: string
  if (fieldCount > 0) {
    const fieldLabel = fieldCount === 1 ? '1 field' : `${fieldCount} fields`
    // Check if any types were modified from inferred
    const modifiedCount = schema.filter((f: any) => f.userType !== f.inferredType).length
    if (modifiedCount > 0) {
      displayValue = `${fieldLabel} (${modifiedCount} modified)`
    } else {
      displayValue = `${fieldLabel} verified`
    }
  } else {
    displayValue = 'Not configured'
  }

  return (
    <SingleCard
      label={[label]}
      value={[displayValue]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.KAFKA_TYPE_VERIFICATION, topicIndex)}
      disabled={disabled}
      selected={activeStep === StepKeys.KAFKA_TYPE_VERIFICATION}
    />
  )
}

// Transformation card component to display stateless transformation configuration
const TransformationCard = ({
  onStepClick,
  disabled,
  activeStep,
  pipeline,
}: {
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  activeStep: StepKeys | null
  pipeline: any
}) => {
  const { transformationStore } = useStore()
  const transformationConfig = transformationStore.transformationConfig

  // Check if transformations are enabled (from store or pipeline)
  // Note: After hydration, stateless_transformation is converted to transformation format
  // So we check store first, then hydrated pipeline, then raw API format
  const hasStatelessTransformation =
    transformationConfig.enabled ||
    pipeline?.transformation?.enabled === true ||
    pipeline?.stateless_transformation?.enabled === true

  // Get field count from store or pipeline (prioritize store, then hydrated, then raw API)
  const fieldCount =
    transformationConfig.fields?.length ||
    pipeline?.transformation?.fields?.length ||
    pipeline?.stateless_transformation?.config?.transform?.length ||
    0

  // Get intermediary schema for display
  const intermediarySchema =
    hasStatelessTransformation && transformationConfig.enabled ? getIntermediarySchema(transformationConfig) : []

  // Determine the display value
  let displayValue: string
  if (hasStatelessTransformation && fieldCount > 0) {
    const fieldLabel = fieldCount === 1 ? '1 field' : `${fieldCount} fields`
    displayValue = fieldLabel
  } else {
    displayValue = 'No transformations configured'
  }

  // Only show card if transformations are enabled and have fields
  if (!hasStatelessTransformation || fieldCount === 0) {
    return null
  }

  return (
    <SingleCard
      label={['Transformations']}
      value={[displayValue]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.TRANSFORMATION_CONFIGURATOR)}
      disabled={disabled}
      selected={activeStep === StepKeys.TRANSFORMATION_CONFIGURATOR}
    />
  )
}

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
  pipeline,
}: {
  topic: any
  hasDedup: boolean
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
  pipeline: any
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Top card: Topic */}
      <SingleCard
        label={['Topic']}
        value={[topic.name]}
        orientation="center"
        width="full"
        onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_1, 0)}
        disabled={disabled}
        validation={validation}
        selected={activeStep === StepKeys.TOPIC_SELECTION_1}
      />

      {/* Type Verification card */}
      <TypeVerificationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} topicIndex={0} />

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
              onClick={() => onStepClick(StepKeys.DEDUPLICATION_CONFIGURATOR, 0)}
              disabled={disabled}
              validation={validation.deduplicationValidation}
              selected={activeStep === StepKeys.DEDUPLICATION_CONFIGURATOR}
            />
          )
        })()}

      {/* Filter card (only if filters feature is enabled) */}
      {isFiltersEnabled() && (
        <FilterCard onStepClick={onStepClick} disabled={disabled} validation={validation} activeStep={activeStep} />
      )}

      {/* Transformation card (if stateless transformations are enabled) */}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

      {/* Bottom card: Destination Table and Schema Mapping */}
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
  leftHasDedup = false,
  rightHasDedup = false,
  pipeline,
}: {
  leftTopic: any
  rightTopic: any
  leftSource: any
  rightSource: any
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
  leftHasDedup?: boolean
  rightHasDedup?: boolean
  pipeline: any
}) => {
  // Get dedup keys from store for display
  const leftDedupKey = (() => {
    const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(0)
    return deduplicationConfig?.enabled ? deduplicationConfig.key : null
  })()

  const rightDedupKey = (() => {
    const deduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(1)
    return deduplicationConfig?.enabled ? deduplicationConfig.key : null
  })()

  return (
    <div className="flex flex-col gap-4">
      {/* Topics - Left and Right (with optional dedup info) */}
      <div className="flex flex-row gap-4">
        {leftHasDedup && leftDedupKey ? (
          <DoubleColumnCard
            label={['Left Topic', 'Dedup Key']}
            value={[leftTopic?.name || 'N/A', leftDedupKey]}
            width="full"
            onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1, 0)}
            disabled={disabled}
            validation={validation.topicsValidation}
            selected={
              activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 || activeStep === StepKeys.TOPIC_SELECTION_1
            }
          />
        ) : (
          <SingleColumnCard
            label={['Left Topic']}
            orientation="left"
            value={[leftTopic?.name || 'N/A']}
            width="full"
            onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_1, 0)}
            disabled={disabled}
            validation={validation.topicsValidation}
            selected={activeStep === StepKeys.TOPIC_SELECTION_1}
          />
        )}

        {rightHasDedup && rightDedupKey ? (
          <DoubleColumnCard
            label={['Dedup Key', 'Right Topic']}
            value={[rightDedupKey, rightTopic?.name || 'N/A']}
            width="full"
            onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2, 1)}
            disabled={disabled}
            validation={validation.topicsValidation}
            selected={
              activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2 || activeStep === StepKeys.TOPIC_SELECTION_2
            }
          />
        ) : (
          <SingleColumnCard
            label={['Right Topic']}
            orientation="right"
            value={[rightTopic?.name || 'N/A']}
            width="full"
            onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_2, 1)}
            disabled={disabled}
            validation={validation.topicsValidation}
            selected={activeStep === StepKeys.TOPIC_SELECTION_2}
          />
        )}
      </div>

      {/* Type Verification - Left and Right */}
      <div className="flex flex-row gap-4">
        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={0}
          label="Left Topic Types"
        />

        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={1}
          label="Right Topic Types"
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

      {/* Note: Filter is not available for multi-topic journeys */}

      {/* Transformation card (if stateless transformations are enabled) */}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

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
  pipeline,
}: {
  leftTopic: any
  rightTopic: any
  leftSource: any
  rightSource: any
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
  pipeline: any
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
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1, 0)}
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
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2, 1)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2}
        />
      </div>

      {/* Type Verification - Left and Right */}
      <div className="flex flex-row gap-4">
        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={0}
          label="Left Topic Types"
        />

        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={1}
          label="Right Topic Types"
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

      {/* Note: Filter is not available for multi-topic journeys */}

      {/* Transformation card (if stateless transformations are enabled) */}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

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
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: any
  activeStep: StepKeys | null
}) {
  // Get fresh data from store instead of stale pipeline config
  const { topicsStore, joinStore, clickhouseDestinationStore, coreStore, deduplicationStore } = useStore()

  // FIX: Extract FULL topic objects from store in correct order (by index)
  // Object.values() doesn't guarantee order, so we must sort by index
  // IMPORTANT: We need the full topic objects, not just {name, deduplication}
  const storeTopics = Object.values(topicsStore.topics).sort((a: any, b: any) => a.index - b.index) // Sort by index to maintain order

  // Fallback to pipeline config if store is empty (e.g., when viewing existing pipeline)
  const topics = storeTopics.length > 0 ? storeTopics : pipeline?.source?.topics || []

  // Robust join detection: require enabled and at least one source/stream
  const hasJoin = Boolean(
    (joinStore.enabled && (joinStore.streams?.length || 0) > 0) ||
      (pipeline?.join?.enabled && (pipeline?.join?.sources?.length || 0) > 0),
  )

  // Get deduplication configs from store and pipeline for strict checks
  const dedup0 = deduplicationStore.getDeduplication(0)
  const dedup1 = deduplicationStore.getDeduplication(1)
  const topic0 = topics[0]
  const topic1 = topics[1]

  const isDedup = (d: any, t: any) => {
    const enabled = d?.enabled === true || t?.deduplication?.enabled === true
    const key = (d?.key || t?.deduplication?.id_field || '').trim()
    return enabled && key.length > 0
  }

  // Check if this is a dedup+join pipeline based on topic count and deduplication configs
  // For 2 topics, check if both have deduplication enabled
  const topicCount = coreStore.topicCount || topics.length
  const isJoinDeduplicationPipeline = topicCount === 2 && isDedup(dedup0, topic0) && isDedup(dedup1, topic1)

  // Use topic count and deduplication configs to determine behavior
  const leftTopicDeduplication = topicCount === 2 && isDedup(dedup0, topic0)
  const rightTopicDeduplication = topicCount === 2 && isDedup(dedup1, topic1)

  // Convert join streams to pipeline config format
  const storeJoinSources =
    joinStore.streams.map((stream: any) => ({
      source_id: stream.topicName,
      join_key: stream.joinKey,
      orientation: stream.orientation,
    })) || []

  // FIX: If join store is invalidated, show empty join keys (N/A)
  // Don't fall back to pipeline config when join is invalidated by topic change
  const isJoinInvalidated = joinStore.validation?.status === 'invalidated'
  const joinSources = isJoinInvalidated
    ? [
        { source_id: '', join_key: '', orientation: 'left' },
        { source_id: '', join_key: '', orientation: 'right' },
      ]
    : storeJoinSources.length > 0
      ? storeJoinSources
      : pipeline?.join?.sources || []

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
    // Check topic count and deduplication config to determine if dedup card should be shown
    // For single topic, show dedup card if deduplication is configured
    const topicCount = coreStore.topicCount || topics.length
    const shouldShowDedupCard = topicCount === 1 && isDedup(dedup0, topic)

    sectionContent = (
      <DeduplicationCase
        topic={topic}
        hasDedup={shouldShowDedupCard}
        destinationTable={destinationTable}
        totalSourceFields={totalSourceFields}
        totalDestinationColumns={totalDestinationColumns}
        onStepClick={onStepClick}
        disabled={disabled}
        validation={validation}
        activeStep={activeStep}
        pipeline={pipeline}
      />
    )
  }
  // Join case (with optional partial deduplication)
  else if (topics.length > 1 && hasJoin && !(leftTopicDeduplication && rightTopicDeduplication)) {
    const leftSource = joinSources.find((s: any) => s.orientation === 'left')
    const rightSource = joinSources.find((s: any) => s.orientation === 'right')

    // FIX: Use index-based lookup as fallback when source_id doesn't match
    // This handles the case where topic is changed but join sources aren't updated yet
    const leftTopic = topics.find((t: any) => t.name === leftSource?.source_id) || topics[0]
    const rightTopic = topics.find((t: any) => t.name === rightSource?.source_id) || topics[1]

    sectionContent = (
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
        leftHasDedup={leftTopicDeduplication}
        rightHasDedup={rightTopicDeduplication}
        pipeline={pipeline}
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
        pipeline={pipeline}
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
        <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />
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
    <div className="flex flex-col gap-4 w-[70%]">
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
