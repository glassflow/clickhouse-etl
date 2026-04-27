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
import type { CanvasSourceType } from '@/src/store/canvas.store'
import type { PipelineDomain, SourceConfig, SinkConfig, ResourceConfig } from '@/src/types/pipeline-domain'

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
 *
 * @param intent   The AI-generated pipeline intent.
 * @param passwords  Optional passwords for Kafka / ClickHouse (never stored in intent).
 * @param targetLane  Where to materialize the intent: 'wizard' (default) pre-fills the
 *                    step-by-step wizard, 'canvas' initialises the React Flow canvas.
 */
export async function materializeIntentToStore(
  intent: PipelineIntentModel,
  passwords?: MaterializationPasswords,
  targetLane: 'wizard' | 'canvas' = 'wizard',
): Promise<MaterializationResult> {
  if (targetLane === 'canvas') {
    return materializeToCanvas(intent)
  }
  return materializeToWizard(intent, passwords)
}

// ─── Canvas lane ──────────────────────────────────────────────────────────────

async function materializeToCanvas(intent: PipelineIntentModel): Promise<MaterializationResult> {
  const store = useStore.getState()
  const errors: Array<{ section: string; error: string }> = []
  const sectionsHydrated: string[] = []

  try {
    const sourceType = resolveCanvasSourceType(intent)
    store.canvasStore.initDefaultPipeline(sourceType)
    sectionsHydrated.push('canvas-pipeline')

    // Source node config
    if (sourceType === 'kafka' && intent.kafka?.bootstrapServers) {
      store.canvasStore.setNodeConfig('source', {
        bootstrapServers: intent.kafka.bootstrapServers,
        topicName: intent.topics?.[0]?.topicName,
      })
      sectionsHydrated.push('canvas-source')
    } else if (sourceType !== 'kafka' && intent.otlp?.endpoint) {
      store.canvasStore.setNodeConfig('source', {
        endpoint: intent.otlp.endpoint,
        protocol: intent.otlp.protocol,
      })
      sectionsHydrated.push('canvas-source')
    }

    // Sink node config
    if (intent.clickhouse?.host) {
      store.canvasStore.setNodeConfig('sink', {
        host: intent.clickhouse.host,
        table: intent.destination?.tableName,
        database: intent.clickhouse.database,
      })
      sectionsHydrated.push('canvas-sink')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push({ section: 'canvas', error: msg })
    structuredLogger.warn('AI materialization (canvas): failed', { error: msg })
  }

  // ── Build PipelineDomain directly from intent and push to domainStore ──
  try {
    const domain = buildDomainFromIntent(intent)
    store.domainStore.setDomain(domain)
    sectionsHydrated.push('domain-set')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push({ section: 'domain', error: msg })
    structuredLogger.warn('AI materialization (canvas): domain setDomain failed', { error: msg })
  }

  const hash = computeMaterializationHash(intent)

  return {
    success: errors.length === 0,
    sectionsHydrated,
    errors,
    materializationHash: hash,
  }
}

/**
 * Builds a PipelineDomain from a PipelineIntentModel (canvas lane).
 * Passwords are never included — they live only in MaterializationPasswords.
 */
function buildDomainFromIntent(intent: PipelineIntentModel): PipelineDomain {
  const sourceType = resolveCanvasSourceType(intent)
  const isOtlp = sourceType !== 'kafka'

  const sources: SourceConfig[] = isOtlp
    ? [
        {
          type: sourceType as 'otlp.logs' | 'otlp.traces' | 'otlp.metrics',
          id: intent.otlp?.endpoint ?? '',
          connectionConfig: {
            endpoint: intent.otlp?.endpoint ?? '',
            protocol: intent.otlp?.protocol ?? 'grpc',
          },
          schemaFields: [],
        },
      ]
    : (intent.topics ?? []).map((t) => ({
        type: 'kafka' as const,
        id: t.topicName ?? '',
        connectionConfig: {
          bootstrapServers: intent.kafka?.bootstrapServers ?? '',
          authMethod: intent.kafka?.authMethod ?? 'NO_AUTH',
          securityProtocol: intent.kafka?.securityProtocol ?? 'PLAINTEXT',
        },
        schemaFields: [],
      }))

  const sink: SinkConfig = {
    type: 'clickhouse',
    connectionConfig: {
      host: intent.clickhouse?.host ?? '',
      database: intent.clickhouse?.database ?? '',
      username: intent.clickhouse?.username ?? 'default',
      secure: intent.clickhouse?.useSSL ?? true,
      skip_certificate_verification: intent.clickhouse?.skipCertificateVerification ?? false,
    },
    tableMapping: (intent.destination?.columnMappings ?? []).map((m) => ({
      sourceField: m.sourceField,
      targetColumn: m.targetColumn,
      columnType: m.targetType ?? 'String',
    })),
  }

  const resources: ResourceConfig = {
    maxBatchSize: 1000,
    maxDelayTime: '1m',
  }

  return {
    id: undefined,
    name: intent.topics?.[0]?.topicName
      ? `${intent.topics[0].topicName}-to-${intent.destination?.tableName ?? 'destination'}`
      : 'ai-pipeline',
    sources,
    transforms: [],
    sink,
    resources,
  }
}

/**
 * Maps the intent's source type to the CanvasSourceType enum.
 * Falls back to 'kafka' when the intent doesn't specify a source type.
 */
function resolveCanvasSourceType(intent: PipelineIntentModel): CanvasSourceType {
  if (intent.sourceType) return intent.sourceType
  if (intent.otlp) {
    const sig = intent.otlp.signalType
    if (sig === 'traces') return 'otlp.traces'
    if (sig === 'metrics') return 'otlp.metrics'
    return 'otlp.logs'
  }
  return 'kafka'
}

// ─── Wizard lane ─────────────────────────────────────────────────────────────

async function materializeToWizard(
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

  // ── 4. Sync domain model from wizard slices ──
  // After all hydrations complete, update domainStore so the domain model
  // reflects what was materialized. This keeps A6 domain state in sync with
  // the wizard lane without requiring individual slices to know about the domain.
  try {
    const freshStore = useStore.getState()
    freshStore.domainStore.syncFromSlices()
    sectionsHydrated.push('domain-sync')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    structuredLogger.warn('AI materialization: domain syncFromSlices failed', { error: msg })
    // Non-fatal — wizard still works without domain sync
  }

  // ── 5. Compute materialization hash for stale detection ──
  const hash = computeMaterializationHash(intent)

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
  const defaultNativePort = useSSL ? 9440 : 9000
  const nativePort = clickhouse?.nativePort ?? defaultNativePort
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function buildDedupTimeWindow(
  topicIntent: { deduplicationWindow?: number; deduplicationWindowUnit?: string } | undefined,
): string {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTableMapping(intent: PipelineIntentModel): any[] {
  if (!intent.destination?.columnMappings?.length) return []
  return intent.destination.columnMappings.map((m) => ({
    source_id: intent.topics?.[0]?.topicName || '',
    field_name: m.sourceField,
    column_name: m.targetColumn,
    column_type: m.targetType || 'String',
  }))
}

function buildPipelineName(intent: PipelineIntentModel): string {
  const topic = intent.topics?.[0]?.topicName
  const db = intent.clickhouse?.database
  const table = intent.destination?.tableName
  if (topic && table) return `${topic}-to-${table}`
  if (topic && db) return `${topic}-to-${db}`
  if (topic) return `pipeline-${topic}`
  return 'ai-pipeline'
}

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
