/**
 * Step Registry — single source of truth for all wizard steps.
 *
 * Adding a new step means editing exactly this file.  All other consumers
 * (componentsMap, STEP_RENDERER_CONFIG, sidebarStepConfig) derive their data
 * from STEP_REGISTRY via the helper functions in their respective modules.
 */

import type { ComponentType } from 'react'
import { StepKeys } from './constants'
import { KafkaConnectionContainer } from '@/src/modules/kafka/KafkaConnectionContainer'
import { KafkaTopicSelector } from '@/src/modules/kafka/KafkaTopicSelector'
import { KafkaTypeVerification } from '@/src/modules/kafka/KafkaTypeVerification'
import { DeduplicationConfigurator } from '@/src/modules/deduplication/DeduplicationConfigurator'
import { FilterConfigurator } from '@/src/modules/filter/FilterConfigurator'
import { TransformationConfigurator } from '@/src/modules/transformation/TransformationConfigurator'
import { JoinConfigurator } from '@/src/modules/join/JoinConfigurator'
import { ClickhouseConnectionContainer } from '@/src/modules/clickhouse/ClickhouseConnectionContainer'
import { ClickhouseMapper } from '@/src/modules/clickhouse/ClickhouseMapper'
import { PipelineResourcesConfigurator } from '@/src/modules/resources/PipelineResourcesConfigurator'
import { ReviewConfiguration } from '@/src/modules/review/ReviewConfiguration'
import { OtlpSignalTypeStep } from '@/src/modules/otlp/components/OtlpSignalTypeStep'
import { OtlpDeduplicationStep } from '@/src/modules/otlp/components/OtlpDeduplicationStep'
import { isFiltersEnabled } from './feature-flags'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Logical grouping of steps in the wizard sidebar.
 * Used for labelling sections and ordering sidebar items.
 */
export type SectionKey =
  | 'source'
  | 'processing'
  | 'destination'
  | 'review'
  | 'otlp'

/**
 * Canonical descriptor for a single wizard step.
 *
 * All fields that were previously scattered across stepsMetadata, componentsMap,
 * sidebarStepConfig, and STEP_RENDERER_CONFIG are consolidated here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StepDescriptor {
  /** The unique step key — matches a value in the StepKeys enum. */
  key: StepKeys

  /**
   * Human-readable title shown in the wizard header.
   * For topic-selection steps the title is contextual (derived at render time
   * from the selected topic name), so this is the base/default title.
   */
  title: string

  /**
   * React component rendered when this step is active.
   * `null` for steps that have no standalone panel (deploy, review).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any> | null

  /**
   * Optional guard evaluated at render time.
   * When it returns `false` the step is hidden / the renderer skips it.
   * The guard is intentionally stateless (no store state parameter) to keep
   * the registry serialisable and testable without a real store instance.
   * If a guard needs store state, wrap it in the consuming component.
   */
  guard?: () => boolean

  /**
   * Steps that must be completed before this step becomes available.
   * Used to derive a simplified adjacency list for navigation guards.
   * NOTE: the full dependency graph in `state-machine/dependency-graph.ts`
   * handles cascading resets across store slices — this field only captures
   * direct wizard-step ordering.
   */
  dependsOn?: StepKeys[]

  /** Sidebar / section grouping key. */
  sectionKey: SectionKey

  /**
   * Title used when this step is open in the pipeline-detail edit panel.
   * Falls back to `title` when absent.
   */
  editTitle?: string

  // -----------------------------------------------------------------------
  // Sidebar display metadata (moved from sidebarStepConfig)
  // -----------------------------------------------------------------------

  /**
   * Title shown in the wizard sidebar.
   * Defaults to `title` when absent.
   */
  sidebarTitle?: string

  /**
   * Parent step key for sidebar hierarchy (null = top-level step).
   * Dynamic parenting (e.g., DEDUPLICATION_CONFIGURATOR whose parent changes
   * based on journey position) is still handled in getSidebarSteps /
   * getSidebarStepsFromInstances.
   */
  sidebarParent?: StepKeys | null

  // -----------------------------------------------------------------------
  // Step-renderer display metadata (moved from STEP_RENDERER_CONFIG)
  // -----------------------------------------------------------------------

  /** Short description shown below the title in the step renderer panel. */
  description?: string
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const STEP_REGISTRY: StepDescriptor[] = [
  // ---- Source ----------------------------------------------------------------

  {
    key: StepKeys.KAFKA_CONNECTION,
    title: 'Setup Kafka Connection',
    sidebarTitle: 'Kafka Connection',
    description: 'Configure your Kafka connection settings',
    editTitle: 'Kafka Connection',
    component: KafkaConnectionContainer,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [],
  },

  {
    key: StepKeys.TOPIC_SELECTION_1,
    title: 'Select Topic',
    sidebarTitle: 'Select Topic',
    description: 'Select the Kafka topic to use',
    component: KafkaTopicSelector,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [StepKeys.KAFKA_CONNECTION],
  },

  {
    key: StepKeys.TOPIC_SELECTION_2,
    title: 'Select Right Topic',
    sidebarTitle: 'Select Right Topic',
    description: 'Select the Kafka topic to use',
    component: KafkaTopicSelector,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [StepKeys.TOPIC_SELECTION_1],
  },

  {
    key: StepKeys.KAFKA_TYPE_VERIFICATION,
    title: 'Verify Field Types',
    sidebarTitle: 'Verify Field Types',
    description: 'Review and adjust the inferred data types for Kafka event fields.',
    editTitle: 'Verify Field Types',
    component: KafkaTypeVerification,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [StepKeys.TOPIC_SELECTION_1],
  },

  {
    key: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
    title: 'Select Left Topic',
    sidebarTitle: 'Select Left Topic',
    description: 'Configure topic deduplication settings',
    component: KafkaTopicSelector,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [StepKeys.KAFKA_CONNECTION],
  },

  {
    key: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
    title: 'Select Right Topic',
    sidebarTitle: 'Select Right Topic',
    description: 'Configure topic deduplication settings',
    component: KafkaTopicSelector,
    sectionKey: 'source',
    sidebarParent: null,
    dependsOn: [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1],
  },

  // ---- Processing ------------------------------------------------------------

  {
    key: StepKeys.DEDUPLICATION_CONFIGURATOR,
    title: 'Define Deduplicate Keys',
    sidebarTitle: 'Deduplicate',
    description: 'Configure deduplication settings',
    editTitle: 'Deduplication',
    component: DeduplicationConfigurator,
    sectionKey: 'processing',
    // Dynamic parent — resolved at render time in getSidebarSteps
    sidebarParent: StepKeys.KAFKA_TYPE_VERIFICATION,
    dependsOn: [StepKeys.KAFKA_TYPE_VERIFICATION],
  },

  {
    key: StepKeys.FILTER_CONFIGURATOR,
    title: 'Define Filter Conditions',
    sidebarTitle: 'Filter',
    description: 'Define filter conditions for events',
    editTitle: 'Filter Configuration',
    component: FilterConfigurator,
    guard: isFiltersEnabled,
    sectionKey: 'processing',
    sidebarParent: StepKeys.KAFKA_TYPE_VERIFICATION,
    dependsOn: [StepKeys.KAFKA_TYPE_VERIFICATION],
  },

  {
    key: StepKeys.TRANSFORMATION_CONFIGURATOR,
    title: 'Define Transformations',
    sidebarTitle: 'Transform',
    description: 'Transform event fields using functions or pass them through unchanged.',
    editTitle: 'Define Transformations',
    component: TransformationConfigurator,
    sectionKey: 'processing',
    sidebarParent: StepKeys.KAFKA_TYPE_VERIFICATION,
    dependsOn: [StepKeys.KAFKA_TYPE_VERIFICATION],
  },

  {
    key: StepKeys.JOIN_CONFIGURATOR,
    title: 'Define Join Key',
    sidebarTitle: 'Join Configuration',
    description: 'Configure join settings',
    editTitle: 'Join Configuration',
    component: JoinConfigurator,
    sectionKey: 'processing',
    sidebarParent: null,
    dependsOn: [StepKeys.TOPIC_SELECTION_2],
  },

  // ---- Destination -----------------------------------------------------------

  {
    key: StepKeys.CLICKHOUSE_CONNECTION,
    title: 'Setup ClickHouse Connection',
    sidebarTitle: 'ClickHouse Connection',
    description: 'Configure your ClickHouse connection settings',
    editTitle: 'ClickHouse Connection',
    component: ClickhouseConnectionContainer,
    sectionKey: 'destination',
    sidebarParent: null,
    dependsOn: [],
  },

  {
    key: StepKeys.CLICKHOUSE_MAPPER,
    title: 'Mapping',
    sidebarTitle: 'Mapping',
    description: 'Configure ClickHouse table mapping',
    editTitle: 'ClickHouse Mapping',
    component: ClickhouseMapper,
    sectionKey: 'destination',
    sidebarParent: null,
    dependsOn: [StepKeys.CLICKHOUSE_CONNECTION],
  },

  {
    key: StepKeys.PIPELINE_RESOURCES,
    title: 'Pipeline Resources',
    sidebarTitle: 'Pipeline Resources',
    description: 'Configure CPU, memory, and storage for each pipeline component',
    editTitle: 'Pipeline Resources',
    component: PipelineResourcesConfigurator,
    sectionKey: 'destination',
    sidebarParent: null,
    dependsOn: [StepKeys.CLICKHOUSE_MAPPER],
  },

  // ---- Review / Deploy -------------------------------------------------------

  {
    key: StepKeys.REVIEW_CONFIGURATION,
    title: 'Review',
    sidebarTitle: 'Review & Deploy',
    description: 'Review and deploy',
    component: ReviewConfiguration,
    sectionKey: 'review',
    sidebarParent: null,
    dependsOn: [StepKeys.PIPELINE_RESOURCES],
  },

  {
    key: StepKeys.DEPLOY_PIPELINE,
    title: 'Deploy Pipeline',
    sidebarTitle: 'Deploy Pipeline',
    description: 'Deploy the pipeline to the ClickHouse database.',
    component: null,
    sectionKey: 'review',
    sidebarParent: null,
    dependsOn: [StepKeys.REVIEW_CONFIGURATION],
  },

  // ---- OTLP ------------------------------------------------------------------

  {
    key: StepKeys.OTLP_SIGNAL_TYPE,
    title: 'OTLP Source',
    sidebarTitle: 'Select Signal Type',
    description: 'Select your OpenTelemetry signal type.',
    component: OtlpSignalTypeStep,
    sectionKey: 'otlp',
    sidebarParent: null,
    dependsOn: [],
  },

  {
    key: StepKeys.OTLP_DEDUPLICATION,
    title: 'Deduplication',
    sidebarTitle: 'Deduplication',
    description: 'Configure deduplication settings for OTLP data',
    editTitle: 'OTLP Deduplication',
    component: OtlpDeduplicationStep,
    sectionKey: 'otlp',
    sidebarParent: StepKeys.OTLP_SIGNAL_TYPE,
    dependsOn: [StepKeys.OTLP_SIGNAL_TYPE],
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Fast O(1) lookup by step key. */
const _registryMap = new Map<StepKeys, StepDescriptor>(STEP_REGISTRY.map((d) => [d.key, d]))

export function getStepDescriptor(key: StepKeys): StepDescriptor | undefined {
  return _registryMap.get(key)
}

/**
 * Derive `componentsMap` — a Record<StepKeys, ComponentType> — from the
 * registry.  Steps with `component: null` are omitted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildComponentsMap(): Partial<Record<StepKeys, ComponentType<any>>> {
  return Object.fromEntries(
    STEP_REGISTRY.filter((d) => d.component !== null).map((d) => [d.key, d.component!]),
  ) as Partial<Record<StepKeys, ComponentType<any>>>
}

/**
 * Derive the sidebarStepConfig shape consumed by getSidebarSteps /
 * getSidebarStepsFromInstances.
 */
export function buildSidebarStepConfig(): Record<StepKeys, { title: string; parent: StepKeys | null | undefined }> {
  return Object.fromEntries(
    STEP_REGISTRY.map((d) => [
      d.key,
      {
        title: d.sidebarTitle ?? d.title,
        parent: d.sidebarParent,
      },
    ]),
  ) as Record<StepKeys, { title: string; parent: StepKeys | null | undefined }>
}
