import type { SchemaField, InternalFieldType } from '@/src/types/schema'
import type { RootStoreState } from '@/src/store/index'
import { isOtlpSource } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import { normalizeFieldType } from '@/src/utils/type-conversion'
import { isFieldComplete } from '@/src/store/transformation.store'

/**
 * Derives the effective source schema from current store state.
 *
 * - OTLP: returns the static OTLP schema for the selected signal type
 * - Single Kafka topic with active transformation: returns transform output fields,
 *   supplemented by any passthrough / raw source fields
 * - Single Kafka topic (no transform): returns verified topic schema fields
 * - Join (two topics): merges fields from both topics
 */
export function getEffectiveSchema(state: RootStoreState): SchemaField[] {
  const { coreStore, otlpStore, topicsStore, transformationStore, joinStore } = state

  // --- OTLP source ---
  if (isOtlpSource(coreStore.sourceType)) {
    const otlpFields = otlpStore.schemaFields.length > 0
      ? otlpStore.schemaFields
      : getOtlpFieldsForSignalType(otlpStore.signalType ?? coreStore.sourceType)
    return otlpFields.map((f) => ({
      name: f.name,
      type: normalizeFieldType(f.type),
      nullable: false,
      source: 'topic' as const,
      originalType: f.type,
    }))
  }

  // --- Transformation output (single topic with active transform) ---
  // Guard: skip transform branch for join pipelines — join fields come from the join branch below.
  // Without this guard, stale transform state from a previous single-topic pipeline would silence
  // the join schema when the user switches to two topics.
  const isJoin = joinStore.enabled && joinStore.streams.length >= 2
  const { transformationConfig } = transformationStore
  const isTransformActive =
    !isJoin && transformationConfig.enabled && transformationConfig.fields.length > 0

  if (isTransformActive) {
    const outputFields: SchemaField[] = transformationConfig.fields
      .filter(isFieldComplete)
      .map((f) => ({
        name: f.outputFieldName,
        type: normalizeFieldType(f.outputFieldType),
        nullable: false,
        source: 'transform' as const,
        originalType: f.outputFieldType,
      }))
    return outputFields
  }

  // --- Join (two topics) ---
  if (isJoin) {
    const topicIndices = [0, 1]
    const merged: SchemaField[] = []
    const seen = new Set<string>()
    for (const idx of topicIndices) {
      const topic = topicsStore.topics[idx]
      const schemaFields = topic?.schema?.fields ?? []
      for (const f of schemaFields) {
        if (f.isRemoved) continue
        const fieldName = f.name
        if (seen.has(fieldName)) continue
        seen.add(fieldName)
        const rawType = f.userType ?? f.type ?? 'string'
        merged.push({
          name: fieldName,
          type: normalizeFieldType(rawType),
          nullable: false,
          source: 'topic' as const,
          originalType: rawType,
        })
      }
    }
    return merged
  }

  // --- Single Kafka topic ---
  const topic = topicsStore.topics[0]
  const schemaFields = topic?.schema?.fields ?? []
  return schemaFields
    .filter((f) => !f.isRemoved)
    .map((f) => {
      const rawType = f.userType ?? f.type ?? 'string'
      return {
        name: f.name,
        type: normalizeFieldType(rawType) as InternalFieldType,
        nullable: false,
        source: 'topic' as const,
        originalType: rawType,
      }
    })
}
