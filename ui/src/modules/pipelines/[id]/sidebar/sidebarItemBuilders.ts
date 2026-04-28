import { StepKeys } from '@/src/config/constants'
import { Pipeline } from '@/src/types/pipeline'
import { isFiltersEnabled } from '@/src/config/feature-flags'
import { getSourceAdapter } from '@/src/adapters/source'

/**
 * Section types for the sidebar
 */
export type SidebarSection =
  | 'monitor'
  | 'resources'
  | 'kafka-connection'
  | 'otlp-source'
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

// Helpers for both v3 (sources[]) and old (source.*) formats

function getPipelineSourceType(pipeline: Pipeline): string {
  const v3Sources = (pipeline as any).sources
  if (Array.isArray(v3Sources) && v3Sources.length > 0) return v3Sources[0]?.type || ''
  return pipeline?.source?.type || ''
}

function getPipelineTopics(pipeline: Pipeline): any[] {
  const v3Sources = (pipeline as any).sources
  if (Array.isArray(v3Sources) && v3Sources.length > 0) {
    return v3Sources.filter((s: any) => getSourceAdapter(s.type || '').type === 'kafka')
  }
  return pipeline?.source?.topics || []
}

function getPipelineTransforms(pipeline: Pipeline): any[] {
  return (pipeline as any).transforms || []
}

/**
 * Get source section items (Kafka connection and topics, or OTLP source)
 */
export function getSourceItems(pipeline: Pipeline): SidebarItem[] {
  if (getSourceAdapter(getPipelineSourceType(pipeline)).type !== 'kafka') {
    const transforms = getPipelineTransforms(pipeline)
    const hasOtlpDedup = pipeline?.source?.deduplication?.enabled === true
      || transforms.some((t: any) => t.type === 'dedup')

    const items: SidebarItem[] = [{ key: 'otlp-source', label: 'OTLP Source' }]
    if (hasOtlpDedup) {
      items.push({ key: 'deduplicate', label: 'Deduplicate', stepKey: StepKeys.OTLP_DEDUPLICATION })
    }
    return items
  }

  const items: SidebarItem[] = [
    { key: 'kafka-connection', label: 'Kafka Connection', stepKey: StepKeys.KAFKA_CONNECTION },
  ]

  const topics = getPipelineTopics(pipeline)
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

  const topics = getPipelineTopics(pipeline)
  const transforms = getPipelineTransforms(pipeline)
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

  // Add Filter: v3 stores filter in transforms[], old format uses pipeline.filter
  const hasFilter = pipeline?.filter?.enabled === true
    || transforms.some((t: any) => t.type === 'filter')
  if (isFiltersEnabled() && hasFilter) {
    items.push({
      key: 'filter',
      label: 'Filter',
      stepKey: StepKeys.FILTER_CONFIGURATOR,
    })
  }

  // Add Transformation: v3 stores stateless in transforms[], old uses transformation/stateless_transformation
  const hasStatelessTransformation =
    pipeline?.transformation?.enabled === true ||
    pipeline?.stateless_transformation?.enabled === true ||
    transforms.some((t: any) => t.type === 'stateless')
  const hasTransformationFields =
    (pipeline?.transformation?.fields?.length ?? 0) > 0 ||
    (pipeline?.stateless_transformation?.config?.transform?.length ?? 0) > 0 ||
    transforms.some((t: any) => t.type === 'stateless' && (t.config?.transforms?.length ?? 0) > 0)

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
 * Get resources section items
 */
export function getResourcesItems(): SidebarItem[] {
  return [
    {
      key: 'resources',
      label: 'Pipeline Resources',
      stepKey: StepKeys.PIPELINE_RESOURCES,
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
    ...getResourcesItems(),
  ]
}
