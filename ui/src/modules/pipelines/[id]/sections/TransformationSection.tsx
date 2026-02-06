import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import {
  DeduplicationCase,
  JoinCase,
  JoinDeduplicationCase,
  FallbackCase,
  isDeduplicationEnabled,
  getTransformationTypeLabel,
  type TransformationValidation,
} from './transformation'

interface TransformationSectionProps {
  pipeline: any
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  validation: TransformationValidation
  activeStep: StepKeys | null
}

/**
 * TransformationSection - Main orchestrator for the transformation column in pipeline details
 *
 * Determines which case component to render based on:
 * - Number of topics
 * - Whether join is enabled
 * - Whether deduplication is enabled on each topic
 */
function TransformationSection({ pipeline, onStepClick, disabled, validation, activeStep }: TransformationSectionProps) {
  // Get fresh data from store instead of stale pipeline config
  const topicsStore = useStore((state) => state.topicsStore)
  const joinStore = useStore((state) => state.joinStore)
  const clickhouseDestinationStore = useStore((state) => state.clickhouseDestinationStore)
  const coreStore = useStore((state) => state.coreStore)

  // Use proper selectors for deduplication to ensure reactivity
  const dedup0 = useStore((state) => state.deduplicationStore.getDeduplication(0))
  const dedup1 = useStore((state) => state.deduplicationStore.getDeduplication(1))

  // Extract topics from store in correct order (by index)
  const storeTopics = Object.values(topicsStore.topics).sort((a: any, b: any) => a.index - b.index)

  // Fallback to pipeline config if store is empty (e.g., when viewing existing pipeline)
  const topics = storeTopics.length > 0 ? storeTopics : pipeline?.source?.topics || []

  // Robust join detection: require enabled and at least one source/stream
  const hasJoin = Boolean(
    (joinStore.enabled && (joinStore.streams?.length || 0) > 0) ||
      (pipeline?.join?.enabled && (pipeline?.join?.sources?.length || 0) > 0),
  )

  // Get topic count and check deduplication status
  const topicCount = coreStore.topicCount || topics.length
  const topic0 = topics[0]
  const topic1 = topics[1]

  const leftTopicDeduplication = topicCount >= 1 && isDeduplicationEnabled(dedup0, topic0)
  const rightTopicDeduplication = topicCount === 2 && isDeduplicationEnabled(dedup1, topic1)

  // Check if this is a dedup+join pipeline based on topic count and deduplication configs
  const isJoinDeduplicationPipeline = topicCount === 2 && leftTopicDeduplication && rightTopicDeduplication

  // Convert join streams to pipeline config format
  const storeJoinSources =
    joinStore.streams.map((stream: any) => ({
      source_id: stream.topicName,
      join_key: stream.joinKey,
      orientation: stream.orientation,
    })) || []

  // If join store is invalidated, show empty join keys (N/A)
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

  // Compute transformation label using shared utility
  const transformationLabel = getTransformationTypeLabel(hasJoin, leftTopicDeduplication, rightTopicDeduplication, pipeline)

  // Common props for all case components
  const commonProps = {
    destinationTable,
    totalSourceFields,
    totalDestinationColumns,
    onStepClick,
    disabled,
    validation,
    activeStep,
    pipeline,
  }

  // Determine which case to render
  let sectionContent = null

  // Single topic case (deduplication or ingest only)
  if (topics.length === 1 && !hasJoin) {
    const shouldShowDedupCard = topicCount === 1 && isDeduplicationEnabled(dedup0, topic0)

    sectionContent = <DeduplicationCase topic={topic0} hasDedup={shouldShowDedupCard} {...commonProps} />
  }
  // Join case with partial or no deduplication
  else if (topics.length > 1 && hasJoin && !isJoinDeduplicationPipeline) {
    const leftSource = joinSources.find((s: any) => s.orientation === 'left')
    const rightSource = joinSources.find((s: any) => s.orientation === 'right')

    // Use index-based lookup as fallback when source_id doesn't match
    const leftTopic = topics.find((t: any) => t.name === leftSource?.source_id) || topics[0]
    const rightTopic = topics.find((t: any) => t.name === rightSource?.source_id) || topics[1]

    sectionContent = (
      <JoinCase
        leftTopic={leftTopic}
        rightTopic={rightTopic}
        leftSource={leftSource}
        rightSource={rightSource}
        leftHasDedup={leftTopicDeduplication}
        rightHasDedup={rightTopicDeduplication}
        {...commonProps}
      />
    )
  }
  // Join & Deduplication case (both topics have dedup)
  else if (topics.length > 1 && hasJoin && isJoinDeduplicationPipeline) {
    sectionContent = (
      <JoinDeduplicationCase
        leftTopic={topics[0]}
        rightTopic={topics[1]}
        leftSource={joinSources.find((s: any) => s.orientation === 'left')}
        rightSource={joinSources.find((s: any) => s.orientation === 'right')}
        {...commonProps}
      />
    )
  }
  // Fallback case
  else {
    sectionContent = <FallbackCase topicsCount={topics.length} hasJoin={hasJoin} {...commonProps} />
  }

  return (
    <div className="flex flex-col gap-4 w-[70%]">
      {/* Transformation */}
      <div className="text-center">
        <span className="text-lg font-bold text-[var(--color-foreground-neutral-faded)]">
          Transformation: {transformationLabel}
        </span>
      </div>
      {sectionContent}
    </div>
  )
}

export default TransformationSection
