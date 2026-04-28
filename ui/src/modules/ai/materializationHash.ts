import type { PipelineIntentModel } from './types'

/**
 * Computes a stable hash of the key intent fields used for materialization.
 * Used to detect if the wizard state has diverged from the AI-generated draft.
 */
export function computeMaterializationHash(intent: PipelineIntentModel): string {
  const keyFields = {
    topicCount: intent.topicCount,
    operationType: intent.operationType,
    sourceType: intent.sourceType,
    kafkaServers: intent.kafka?.bootstrapServers,
    otlpEndpoint: intent.otlp?.endpoint,
    topics: intent.topics?.map((t) => t.topicName).join(','),
    clickhouseHost: intent.clickhouse?.host,
    clickhouseDb: intent.clickhouse?.database,
    destinationTable: intent.destination?.tableName,
    filterExpression: intent.filter?.expression,
  }

  return hashObject(keyFields)
}

function hashObject(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort())
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}
