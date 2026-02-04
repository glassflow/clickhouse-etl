import { StepKeys } from '@/src/config/constants'
import {
  KafkaConnectionContainer,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionContainer,
  ClickhouseMapper,
} from '@/src/modules'
import { KafkaTypeVerification } from '@/src/modules/kafka/KafkaTypeVerification'
import { JoinConfigurator } from '@/src/modules/join/JoinConfigurator'
import { FilterConfigurator } from '@/src/modules/filter/FilterConfigurator'
import { TransformationConfigurator } from '@/src/modules/transformation/TransformationConfigurator'
import { isFiltersEnabled } from '@/src/config/feature-flags'
import type { ComponentType } from 'react'

/**
 * Configuration for each step in the step renderer
 */
export interface StepConfig {
  component: ComponentType<any>
  title: string
  description: string
  /**
   * Optional guard function - if returns false, step should be closed
   */
  guard?: () => boolean
}

/**
 * Step renderer configuration map
 * Maps StepKeys to their component, title, and description
 */
export const STEP_RENDERER_CONFIG: Record<StepKeys, StepConfig | undefined> = {
  [StepKeys.KAFKA_CONNECTION]: {
    component: KafkaConnectionContainer,
    title: 'Kafka Connection',
    description: 'Configure your Kafka connection settings',
  },
  [StepKeys.TOPIC_SELECTION_1]: {
    component: KafkaTopicSelector,
    title: 'Kafka Topic Selection',
    description: 'Select the Kafka topic to use',
  },
  [StepKeys.TOPIC_SELECTION_2]: {
    component: KafkaTopicSelector,
    title: 'Kafka Topic Selection',
    description: 'Select the Kafka topic to use',
  },
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
    component: DeduplicationConfigurator,
    title: 'Deduplication',
    description: 'Configure deduplication settings',
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: {
    component: KafkaTopicSelector,
    title: 'Topic Deduplication',
    description: 'Configure topic deduplication settings',
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
    component: KafkaTopicSelector,
    title: 'Topic Deduplication',
    description: 'Configure topic deduplication settings',
  },
  [StepKeys.JOIN_CONFIGURATOR]: {
    component: JoinConfigurator,
    title: 'Join Configuration',
    description: 'Configure join settings',
  },
  [StepKeys.FILTER_CONFIGURATOR]: {
    component: FilterConfigurator,
    title: 'Filter Configuration',
    description: 'Define filter conditions for events',
    guard: isFiltersEnabled,
  },
  [StepKeys.TRANSFORMATION_CONFIGURATOR]: {
    component: TransformationConfigurator,
    title: 'Define Transformations',
    description: 'Transform event fields using functions or pass them through unchanged.',
  },
  [StepKeys.CLICKHOUSE_CONNECTION]: {
    component: ClickhouseConnectionContainer,
    title: 'ClickHouse Connection',
    description: 'Configure your ClickHouse connection settings',
  },
  [StepKeys.CLICKHOUSE_MAPPER]: {
    component: ClickhouseMapper,
    title: 'ClickHouse Mapping',
    description: 'Configure ClickHouse table mapping',
  },
  [StepKeys.KAFKA_TYPE_VERIFICATION]: {
    component: KafkaTypeVerification,
    title: 'Verify Field Types',
    description: 'Review and adjust the inferred data types for Kafka event fields.',
  },
  // Steps used in wizard flow (not in StandaloneStepRenderer)
  [StepKeys.REVIEW_CONFIGURATION]: undefined,
  [StepKeys.DEPLOY_PIPELINE]: undefined,
}

/**
 * Get step configuration by step key
 * Returns undefined if step is not configured or guard fails
 */
export function getStepConfig(stepKey: StepKeys): StepConfig | undefined {
  const config = STEP_RENDERER_CONFIG[stepKey]
  if (!config) return undefined
  
  // Check guard if present
  if (config.guard && !config.guard()) {
    return undefined
  }
  
  return config
}
