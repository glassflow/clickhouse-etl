/**
 * Materialization bridge: converts PipelineIntentModel → Zustand store state.
 *
 * This is the ONLY path through which AI intent affects domain slices.
 * It uses the existing hydrateSection() orchestration to ensure all existing
 * validation, invalidation, and side-effect logic is preserved.
 *
 * Runs CLIENT-SIDE only (in the browser, called from the AI page component).
 */

import { useStore } from '@/src/store'
import { computeMaterializationHash } from './materializationHash'
import { structuredLogger } from '@/src/observability'
import { generatePipelineId } from '@/src/utils/common.client'
import type { PipelineIntentModel } from './types'

export interface MaterializationResult {
  success: boolean
  sectionsHydrated: string[]
  errors: Array<{ section: string; error: string }>
  materializationHash: string
}

export interface MaterializationPasswords {
  kafkaPassword?: string
  clickhousePassword?: string
}

/**
 * Converts a PipelineIntentModel into slice state using existing hydration paths.
 * Caller must await this function before navigating to the wizard.
 */
export async function materializeIntentToStore(
  intent: PipelineIntentModel,
  passwords?: MaterializationPasswords,
): Promise<MaterializationResult> {
  const store = useStore.getState()
  const sectionsHydrated: string[] = []
  const errors: Array<{ section: string; error: string }> = []

  // ── 1. Set topic count first — this drives the entire wizard journey ──
  const topicCount = intent.topicCount || 1
  store.resetForNewPipeline(topicCount)

  // ── 1b. Set pipeline name and ID (required by wizard) ──
  const pipelineName = buildPipelineName(intent)
  store.coreStore.setPipelineName(pipelineName)
  store.coreStore.setPipelineId(generatePipelineId(pipelineName))

  // ── 2. Build partial pipeline config from intent ──
  const partialConfig = buildPartialConfig(intent, passwords)

  // ── 3. Hydrate sections that have enough data ──

  // Kafka connection
  if (intent.kafka?.bootstrapServers) {
    try {
      await store.coreStore.hydrateSection('kafka', partialConfig)
      sectionsHydrated.push('kafka')

      // Mark kafka as valid if connection was confirmed
      if (intent.kafka.connectionStatus === 'valid') {
        store.kafkaStore.markAsValid()
        store.kafkaStore.setIsConnected(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ section: 'kafka', error: msg })
      structuredLogger.warn('AI materialization: kafka hydration failed', { error: msg })
    }
  }

  // Topics (requires kafka to be hydrated first)
  if (intent.topics?.length && intent.topics[0]?.topicName) {
    try {
      await store.coreStore.hydrateSection('topics', partialConfig)
      sectionsHydrated.push('topics')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ section: 'topics', error: msg })
      structuredLogger.warn('AI materialization: topics hydration failed', { error: msg })
    }
  }

  // Deduplication (handled alongside topics hydration above)
  if (intent.operationType === 'deduplication' && intent.topics?.[0]?.deduplicationEnabled) {
    sectionsHydrated.push('deduplication')
  }

  // ClickHouse connection
  if (intent.clickhouse?.host) {
    try {
      await store.coreStore.hydrateSection('clickhouse-connection', partialConfig)
      sectionsHydrated.push('clickhouse-connection')

      if (intent.clickhouse.connectionStatus === 'valid') {
        store.clickhouseConnectionStore.markAsValid()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ section: 'clickhouse-connection', error: msg })
      structuredLogger.warn('AI materialization: clickhouse-connection hydration failed', { error: msg })
    }
  }

  // ClickHouse destination (table + mapping)
  if (intent.destination?.tableName) {
    try {
      await store.coreStore.hydrateSection('clickhouse-destination', partialConfig)
      sectionsHydrated.push('clickhouse-destination')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ section: 'clickhouse-destination', error: msg })
      structuredLogger.warn('AI materialization: clickhouse-destination hydration failed', { error: msg })
    }
  }

  // Filter (optional)
  if (intent.filter?.expression) {
    try {
      await store.coreStore.hydrateSection('filter', partialConfig)
      sectionsHydrated.push('filter')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ section: 'filter', error: msg })
      structuredLogger.warn('AI materialization: filter hydration failed', { error: msg })
    }
  }

  // ── 4. Compute materialization hash for stale detection ──
  const hash = computeMaterializationHash(intent)

  // ── 5. Store the materialization hash in AI session store ──
  store.aiSessionStore.setMaterializationHash(hash)
  store.aiSessionStore.setAiStatus('ready')

  return {
    success: errors.length === 0,
    sectionsHydrated,
    errors,
    materializationHash: hash,
  }
}

// ─── Config builder ───────────────────────────────────────────────────────────

/**
 * Converts PipelineIntentModel to the pipeline config shape that the existing hydration
 * functions understand. Uses snake_case field names matching the backend/hydration format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPartialConfig(intent: PipelineIntentModel, passwords?: MaterializationPasswords): any {
  const kafka = intent.kafka
  const clickhouse = intent.clickhouse

  const useSSL = clickhouse?.useSSL ?? true
  // Default native port: 9440 for SSL, 9000 for non-SSL
  const defaultNativePort = useSSL ? 9440 : 9000
  const nativePort = clickhouse?.nativePort ?? defaultNativePort
  // Default HTTP port: 8443 for SSL, 8123 for non-SSL
  const defaultHttpPort = useSSL ? 8443 : 8123
  const httpPort = clickhouse?.httpPort ?? defaultHttpPort

  return {
    name: '',
    source: {
      type: 'kafka',
      provider: 'kafka',
      connection_params: {
        brokers: kafka?.bootstrapServers
          ? kafka.bootstrapServers.split(',').map((s) => s.trim())
          : [],
        protocol: kafka?.securityProtocol || 'PLAINTEXT',
        mechanism: mapAuthMethodToMechanism(kafka?.authMethod || 'NO_AUTH'),
        username: kafka?.username || undefined,
        password: passwords?.kafkaPassword || undefined,
        skip_auth: !kafka?.authMethod || kafka.authMethod === 'NO_AUTH' ? true : undefined,
      },
      topics: buildTopicsConfig(intent),
    },
    join: {
      type: 'inner',
      enabled: false,
      sources: [],
    },
    filter: intent.filter?.expression
      ? {
          enabled: true,
          expression: intent.filter.expression,
        }
      : undefined,
    sink: {
      type: 'clickhouse',
      host: clickhouse?.host || '',
      http_port: String(httpPort),
      port: String(nativePort),
      database: clickhouse?.database || '',
      username: clickhouse?.username || 'default',
      password: passwords?.clickhousePassword || undefined,
      table: intent.destination?.tableName || '',
      table_name: intent.destination?.createNewTable ? (intent.destination.tableName || '') : undefined,
      destination_path: intent.destination?.createNewTable ? 'create' : 'existing',
      secure: useSSL,
      table_mapping: buildTableMapping(intent),
      max_batch_size: 1000,
      max_delay_time: '1s',
      skip_certificate_verification: clickhouse?.skipCertificateVerification ?? false,
    },
  }
}

function buildTopicsConfig(intent: PipelineIntentModel): any[] {
  const topicCount = intent.topicCount || 1
  const topics = []

  for (let i = 0; i < topicCount; i++) {
    const topicIntent = intent.topics?.[i]
    const dedupEnabled = topicIntent?.deduplicationEnabled || false
    const dedupKey = topicIntent?.deduplicationKey || ''
    const dedupWindow = buildDedupTimeWindow(topicIntent)

    topics.push({
      name: topicIntent?.topicName || '',
      id: topicIntent?.topicName || '',
      schema: {
        type: 'json',
        fields: [],
      },
      consumer_group_initial_offset: 'latest',
      deduplication: {
        enabled: dedupEnabled,
        id_field: dedupKey,
        id_field_type: 'string',
        time_window: dedupEnabled ? dedupWindow : '0s',
      },
    })
  }

  return topics
}

function buildDedupTimeWindow(topicIntent: { deduplicationWindow?: number; deduplicationWindowUnit?: string } | undefined): string {
  if (!topicIntent?.deduplicationWindow) return '1h'
  const value = topicIntent.deduplicationWindow
  const unit = topicIntent.deduplicationWindowUnit || 'hours'
  switch (unit) {
    case 'seconds': return `${value}s`
    case 'minutes': return `${value}m`
    case 'hours': return `${value}h`
    case 'days': return `${value * 24}h`
    default: return `${value}h`
  }
}

function buildTableMapping(intent: PipelineIntentModel): any[] {
  if (!intent.destination?.columnMappings?.length) return []
  return intent.destination.columnMappings.map((m) => ({
    source_id: intent.topics?.[0]?.topicName || '',
    field_name: m.sourceField,
    column_name: m.targetColumn,
    column_type: m.targetType || 'String',
  }))
}

/**
 * Derives a reasonable pipeline name from the intent.
 */
function buildPipelineName(intent: PipelineIntentModel): string {
  const topic = intent.topics?.[0]?.topicName
  const db = intent.clickhouse?.database
  const table = intent.destination?.tableName
  if (topic && table) return `${topic}-to-${table}`
  if (topic && db) return `${topic}-to-${db}`
  if (topic) return `pipeline-${topic}`
  return 'ai-pipeline'
}

/**
 * Maps UI auth method names to backend mechanism field values.
 */
function mapAuthMethodToMechanism(authMethod: string): string {
  switch (authMethod) {
    case 'NO_AUTH': return 'NO_AUTH'
    case 'SASL/PLAIN': return 'PLAIN'
    case 'SASL/SCRAM-256': return 'SCRAM-SHA-256'
    case 'SASL/SCRAM-512': return 'SCRAM-SHA-512'
    case 'SASL/OAUTHBEARER': return 'OAUTHBEARER'
    case 'SASL/GSSAPI': return 'GSSAPI'
    case 'SASL/JAAS': return 'JAAS'
    case 'SASL/LDAP': return 'LDAP'
    case 'mTLS': return 'MTLS'
    case 'AWS_MSK_IAM': return 'AWS_MSK_IAM'
    case 'Delegation tokens': return 'DELEGATION_TOKEN'
    default: return 'NO_AUTH'
  }
}
