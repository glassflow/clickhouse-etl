import { StepKeys } from '@/src/config/constants'
import { KafkaConnectionContainer } from '../kafka/KafkaConnectionContainer'
import { KafkaTopicSelector } from '../kafka/KafkaTopicSelector'
import { DeduplicationConfigurator } from '../deduplication/DeduplicationConfigurator'
import { ClickhouseConnectionContainer } from '../clickhouse/ClickhouseConnectionContainer'
import { ClickhouseMapper } from '../clickhouse/ClickhouseMapper'
import { ReviewConfiguration } from '../review/ReviewConfiguration'
import { JoinConfigurator } from '../join/JoinConfigurator'
import { OperationKeys } from '@/src/config/constants'

// Legacy journeys kept for backward compatibility
export const deduplicationJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.DEDUPLICATION_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const joinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.TOPIC_SELECTION_2,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const ingestOnlyJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const deduplicateJoinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

// New topic count-based journeys
export const getSingleTopicJourney = (): StepKeys[] => {
  // 1 Topic: Kafka Connection → Topic Selection → ClickHouse Connection → Mapper → Review
  // Deduplication is configured optionally within the topic selector
  return [
    StepKeys.KAFKA_CONNECTION,
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.CLICKHOUSE_CONNECTION,
    StepKeys.CLICKHOUSE_MAPPER,
    StepKeys.REVIEW_CONFIGURATION,
  ]
}

export const getTwoTopicJourney = (): StepKeys[] => {
  // 2 Topics: Kafka Connection → Topic 1 Selection → Topic 2 Selection → Join Configurator → ClickHouse Connection → Mapper → Review
  // Deduplication is configured optionally per-topic within each topic selector
  return [
    StepKeys.KAFKA_CONNECTION,
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.TOPIC_SELECTION_2,
    StepKeys.JOIN_CONFIGURATOR,
    StepKeys.CLICKHOUSE_CONNECTION,
    StepKeys.CLICKHOUSE_MAPPER,
    StepKeys.REVIEW_CONFIGURATION,
  ]
}

export const componentsMap = {
  [StepKeys.KAFKA_CONNECTION]: KafkaConnectionContainer,
  [StepKeys.TOPIC_SELECTION_1]: KafkaTopicSelector,
  [StepKeys.TOPIC_SELECTION_2]: KafkaTopicSelector,
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: DeduplicationConfigurator,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: KafkaTopicSelector,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: KafkaTopicSelector,
  [StepKeys.JOIN_CONFIGURATOR]: JoinConfigurator,
  [StepKeys.CLICKHOUSE_CONNECTION]: ClickhouseConnectionContainer,
  [StepKeys.CLICKHOUSE_MAPPER]: ClickhouseMapper,
  [StepKeys.REVIEW_CONFIGURATION]: ReviewConfiguration,
}

// Helper function to convert journey array to component map
const getJourneyComponents = (journey: StepKeys[]): Record<string, React.ComponentType<any>> => {
  return journey.reduce(
    (acc, step) => {
      // @ts-expect-error - FIXME: fix this later
      acc[step] = componentsMap[step]
      return acc
    },
    {} as Record<StepKeys, React.ComponentType<any>>,
  )
}

// New function: Get wizard journey steps based on topic count
export const getWizardJourneySteps = (topicCount: number | undefined): Record<string, React.ComponentType<any>> => {
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    // Return empty object if topicCount is invalid
    return {}
  }

  if (topicCount === 1) {
    return getJourneyComponents(getSingleTopicJourney())
  } else {
    return getJourneyComponents(getTwoTopicJourney())
  }
}

// Legacy function: Get wizard journey steps based on operation (for backward compatibility)
export const getWizardJourneyStepsFromOperation = (
  operation: string | undefined,
): Record<string, React.ComponentType<any>> => {
  if (!operation) {
    // Return empty object if operation is undefined
    return {}
  }

  // Map operation to topic count for backward compatibility
  // This allows existing code to still work while we migrate
  switch (operation) {
    case OperationKeys.DEDUPLICATION:
      return getJourneyComponents(deduplicationJourney)
    case OperationKeys.JOINING:
      return getJourneyComponents(joinJourney)
    case OperationKeys.INGEST_ONLY:
      return getJourneyComponents(ingestOnlyJourney)
    case OperationKeys.DEDUPLICATION_JOINING:
      return getJourneyComponents(deduplicateJoinJourney)
    default:
      return {}
  }
}
