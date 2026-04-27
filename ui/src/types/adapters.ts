/**
 * Source adapter interface — abstracts Kafka vs OTLP source differences.
 *
 * Invariants:
 * - toWireSource: pure — no side effects, no network calls
 * - fromWireSource: dispatches to hydration callbacks only — never writes store directly
 * - getTopicStepKeys: returns the StepKeys relevant for this source type
 */

export interface SourceWireResult {
  /** The `source` field of InternalPipelineConfig */
  source: unknown
  /**
   * Whether this source supports the join section.
   * OTLP: false. Kafka single-topic: false. Kafka two-topic: true.
   */
  supportsJoin: boolean
  /**
   * Whether filter and transformation sections are applicable for this source.
   * OTLP and single-topic Kafka: true. Multi-topic Kafka: false.
   */
  supportsSingleTopicFeatures: boolean
}

export interface AdapterDispatch {
  hydrateKafkaConnection?: (wire: unknown) => void
  hydrateTopics?: (wire: unknown) => Promise<void>
  hydrateOtlp?: (wire: unknown) => void
}

export interface SourceAdapter {
  readonly type: 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'

  /**
   * Whether this source supports the join section.
   * OTLP: false. Kafka single-topic: false. Kafka two-topic: true.
   */
  readonly supportsJoin: boolean

  /**
   * Whether filter and transformation sections are applicable for this source.
   * OTLP: true. Kafka single-topic: true. Kafka multi-topic: false.
   */
  readonly supportsSingleTopicFeatures: boolean

  /**
   * Convert store state into the `source` section of InternalPipelineConfig.
   * Pure transformation — no side effects.
   */
  toWireSource(storeState: SourceAdapterStoreState): SourceWireResult

  /**
   * Dispatch hydration from a wire config back to the store via callbacks.
   * No direct store writes.
   */
  fromWireSource(wire: unknown, dispatch: AdapterDispatch): void | Promise<void>

  /**
   * Returns the StepKeys string IDs relevant for this source type.
   * Used to determine which steps are active in the wizard journey.
   */
  getTopicStepKeys(): string[]
}

/**
 * Store state passed to toWireSource.
 * Typed loosely to avoid deep coupling; adapters cast to their specific shape.
 */
export interface SourceAdapterStoreState {
  kafkaStore?: unknown
  topicsStore?: unknown
  deduplicationStore?: unknown
  otlpStore?: unknown
  coreStore?: unknown
  pipelineName?: string
}
