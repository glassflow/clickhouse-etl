/**
 * Pipeline Details Module Constants
 *
 * Constants used throughout the pipeline details module.
 * Centralizing these ensures consistency between sidebar, step renderer,
 * and the details module itself.
 */

import { StepKeys } from '@/src/config/constants'

/**
 * Steps that belong to the source (Kafka) section of the pipeline.
 * Used to determine which overview card should be highlighted.
 */
export const SOURCE_STEPS = new Set<StepKeys>([StepKeys.KAFKA_CONNECTION])

/**
 * Steps that belong to the transformation section of the pipeline.
 * Includes topic selection, deduplication, join, filter, and transformation steps.
 */
export const TRANSFORMATION_STEPS = new Set<StepKeys>([
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.TOPIC_SELECTION_2,
  StepKeys.DEDUPLICATION_CONFIGURATOR,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
  StepKeys.FILTER_CONFIGURATOR,
  StepKeys.TRANSFORMATION_CONFIGURATOR,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_MAPPER,
])

/**
 * Steps that belong to the sink (ClickHouse) section of the pipeline.
 */
export const SINK_STEPS = new Set<StepKeys>([StepKeys.CLICKHOUSE_CONNECTION])

/**
 * Helper function to determine if a step belongs to the source section.
 */
export function isSourceStep(step: StepKeys | null): boolean {
  return step !== null && SOURCE_STEPS.has(step)
}

/**
 * Helper function to determine if a step belongs to the transformation section.
 */
export function isTransformationStep(step: StepKeys | null): boolean {
  return step !== null && TRANSFORMATION_STEPS.has(step)
}

/**
 * Helper function to determine if a step belongs to the sink section.
 */
export function isSinkStep(step: StepKeys | null): boolean {
  return step !== null && SINK_STEPS.has(step)
}

/**
 * Animation timing constants for the details page.
 */
export const ANIMATION_DELAYS = {
  /** Delay before showing the status overview section */
  STATUS_OVERVIEW: 500,
  /** Delay before showing the configuration section */
  CONFIGURATION: 1000,
} as const

/**
 * Session storage key for pipeline hydration cache.
 */
export const HYDRATION_CACHE_KEY = 'lastHydratedPipeline'
