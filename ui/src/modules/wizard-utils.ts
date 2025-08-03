import { OperationKeys, StepKeys } from '@/src/config/constants'
import { KafkaConnectionContainer } from './kafka/KafkaConnectionContainer'
import { KafkaTopicSelector } from './kafka/KafkaTopicSelector'
import { DeduplicationConfigurator } from './deduplication/DeduplicationConfigurator'
import { ClickhouseConnectionContainer } from './clickhouse/ClickhouseConnectionContainer'
import { ClickhouseMapper } from './clickhouse/ClickhouseMapper'
import { ReviewConfiguration } from './review/ReviewConfiguration'
import { JoinConfigurator } from './join/JoinConfigurator'

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
  StepKeys.TOPIC_SELECTION_1, // duplicate step - we need to add a new topic - topic 1
  StepKeys.TOPIC_SELECTION_2, // duplicate step - we need to add a new topic - topic 2
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

export const getWizardJourneySteps = (operation: string | undefined): Record<string, React.ComponentType<any>> => {
  if (!operation) {
    // Return empty object if operation is undefined
    return {}
  }

  const getJourney = (journey: StepKeys[]) => {
    return journey.reduce(
      (acc, step) => {
        // @ts-expect-error - FIXME: fix this later
        acc[step] = componentsMap[step]
        return acc
      },
      {} as Record<StepKeys, React.ComponentType<any>>,
    )
  }

  switch (operation) {
    case OperationKeys.DEDUPLICATION:
      return getJourney(deduplicationJourney)
    case OperationKeys.JOINING:
      return getJourney(joinJourney)
    case OperationKeys.INGEST_ONLY:
      return getJourney(ingestOnlyJourney)
    case OperationKeys.DEDUPLICATION_JOINING:
      return getJourney(deduplicateJoinJourney)
    default:
      return {}
  }
}
