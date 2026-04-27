/**
 * Source adapter factory.
 *
 * Call sites outside src/adapters/ should use getSourceAdapter() instead of
 * branching on isOtlpSource() directly for config building and hydration.
 *
 * Note: isOtlpSource() is still called here in the factory itself — that is the
 * single authoritative branch point.
 */

import { KafkaSourceAdapter } from './kafka/adapter'
import { OtlpSourceAdapter } from './otlp/adapter'
import type { SourceAdapter } from '@/src/types/adapters'
import { SourceType, isOtlpSource } from '@/src/config/source-types'

const kafkaAdapter = new KafkaSourceAdapter()

const otlpAdapters = new Map<string, SourceAdapter>([
  [SourceType.OTLP_LOGS, new OtlpSourceAdapter(SourceType.OTLP_LOGS)],
  [SourceType.OTLP_TRACES, new OtlpSourceAdapter(SourceType.OTLP_TRACES)],
  [SourceType.OTLP_METRICS, new OtlpSourceAdapter(SourceType.OTLP_METRICS)],
])

/**
 * Returns the source adapter for the given sourceType string.
 * Falls back to the Kafka adapter for unknown types.
 */
export function getSourceAdapter(sourceType: string | undefined | null): SourceAdapter {
  if (!sourceType) return kafkaAdapter
  if (isOtlpSource(sourceType)) {
    return otlpAdapters.get(sourceType) ?? (otlpAdapters.get(SourceType.OTLP_LOGS) as SourceAdapter)
  }
  return kafkaAdapter
}
