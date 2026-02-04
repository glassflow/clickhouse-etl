import { StepKeys } from '@/src/config/constants'
import { Pipeline } from '@/src/types/pipeline'
import { isFiltersEnabled } from '@/src/config/feature-flags'

/**
 * Section types for the sidebar
 */
export type SidebarSection =
  | 'monitor'
  | 'kafka-connection'
  | 'topic'
  | 'left-topic'
  | 'right-topic'
  | 'type-verification'
  | 'left-type-verification'
  | 'right-type-verification'
  | 'filter'
  | 'transformation'
  | 'deduplicate'
  | 'left-deduplicate'
  | 'right-deduplicate'
  | 'join'
  | 'clickhouse-connection'
  | 'destination'

/**
 * Sidebar item configuration
 */
export interface SidebarItem {
  key: SidebarSection
  label: string
  stepKey?: StepKeys
  topicIndex?: number
}

/**
 * Get source section items (Kafka connection and topics)
 */
export function getSourceItems(pipeline: Pipeline): SidebarItem[] {
  const items: SidebarItem[] = [
    { key: 'kafka-connection', label: 'Kafka Connection', stepKey: StepKeys.KAFKA_CONNECTION },
  ]

  const topics = pipeline?.source?.topics || []
  const topicCount = topics.length
  const isMultiTopic = topicCount > 1

  if (isMultiTopic) {
    // Multi-topic pipeline: Left Topic and Right Topic
    const leftTopicHasDedup = topics[0]?.deduplication?.enabled === true
    const rightTopicHasDedup = topics[1]?.deduplication?.enabled === true

    items.push({
      key: 'left-topic',
      label: leftTopicHasDedup ? 'Left Topic & Dedup' : 'Left Topic',
      stepKey: leftTopicHasDedup ? StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 : StepKeys.TOPIC_SELECTION_1,
      topicIndex: 0,
    })

    items.push({
      key: 'left-type-verification',
      label: 'Left Topic Types',
      stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
      topicIndex: 0,
    })

    items.push({
      key: 'right-topic',
      label: rightTopicHasDedup ? 'Right Topic & Dedup' : 'Right Topic',
      stepKey: rightTopicHasDedup ? StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2 : StepKeys.TOPIC_SELECTION_2,
      topicIndex: 1,
    })

    items.push({
      key: 'right-type-verification',
      label: 'Right Topic Types',
      stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
      topicIndex: 1,
    })
  } else {
    // Single topic pipeline
    items.push({
      key: 'topic',
      label: 'Topic',
      stepKey: StepKeys.TOPIC_SELECTION_1,
      topicIndex: 0,
    })

    items.push({
      key: 'type-verification',
      label: 'Verify Field Types',
      stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
      topicIndex: 0,
    })

    // Add deduplication for single topic if enabled
    const hasDeduplication = topics[0]?.deduplication?.enabled === true
    if (hasDeduplication) {
      items.push({
        key: 'deduplicate',
        label: 'Deduplicate',
        stepKey: StepKeys.DEDUPLICATION_CONFIGURATOR,
        topicIndex: 0,
      })
    }
  }

  return items
}

/**
 * Get transformation section items (join, filter, transformations)
 */
export function getTransformationItems(pipeline: Pipeline): SidebarItem[] {
  const items: SidebarItem[] = []

  const topics = pipeline?.source?.topics || []
  const isMultiTopic = topics.length > 1
  const hasJoin = pipeline?.join?.enabled === true

  // Add Join Configuration for multi-topic pipelines
  if (isMultiTopic && hasJoin) {
    items.push({
      key: 'join',
      label: 'Join Configuration',
      stepKey: StepKeys.JOIN_CONFIGURATOR,
    })
  }

  // Add Filter section (only if filters feature is enabled)
  if (isFiltersEnabled()) {
    items.push({
      key: 'filter',
      label: 'Filter',
      stepKey: StepKeys.FILTER_CONFIGURATOR,
    })
  }

  // Add Transformation section (if stateless transformations are enabled)
  const hasStatelessTransformation =
    pipeline?.transformation?.enabled === true || pipeline?.stateless_transformation?.enabled === true
  const hasTransformationFields =
    (pipeline?.transformation?.fields?.length ?? 0) > 0 ||
    (pipeline?.stateless_transformation?.config?.transform?.length ?? 0) > 0

  if (hasStatelessTransformation && hasTransformationFields) {
    items.push({
      key: 'transformation',
      label: 'Transformations',
      stepKey: StepKeys.TRANSFORMATION_CONFIGURATOR,
    })
  }

  return items
}

/**
 * Get sink section items (ClickHouse connection and destination)
 */
export function getSinkItems(): SidebarItem[] {
  return [
    {
      key: 'clickhouse-connection',
      label: 'ClickHouse Connection',
      stepKey: StepKeys.CLICKHOUSE_CONNECTION,
    },
    {
      key: 'destination',
      label: 'Destination',
      stepKey: StepKeys.CLICKHOUSE_MAPPER,
    },
  ]
}

/**
 * Get all sidebar items for a pipeline
 * Combines monitor, source, transformation, and sink items
 */
export function getSidebarItems(pipeline: Pipeline): SidebarItem[] {
  return [
    { key: 'monitor', label: 'Monitor' },
    ...getSourceItems(pipeline),
    ...getTransformationItems(pipeline),
    ...getSinkItems(),
  ]
}
