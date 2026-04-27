/**
 * domain.store.ts — A6: PipelineDomain Core Model
 *
 * `domainStore` is the canonical, first-class representation of a pipeline.
 * It is additive — all existing wizard slices continue to function unchanged.
 *
 * Key responsibilities:
 *  - `setDomain` / `updateXxx` — canvas and AI lanes write here directly
 *  - `syncFromSlices` — wizard lane populates domain after each hydration
 *  - `toWireFormat` — single place that derives InternalPipelineConfig from the domain
 *  - `getSchema` — threads the domain's transforms through the plugin registry
 *  - `validate` — lightweight structural validation (not schema-level)
 */

import { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SchemaField } from '@/src/types/schema'
import type { InternalPipelineConfig } from '@/src/types/pipeline'
import type {
  PipelineDomain,
  SourceConfig,
  TransformConfig,
  SinkConfig,
  ResourceConfig,
} from '@/src/types/pipeline-domain'
import { getSourceAdapter } from '@/src/adapters/source'
import { normalizeFieldType } from '@/src/utils/type-conversion'

// ─── Default values ───────────────────────────────────────────────────────────

const defaultSink: SinkConfig = {
  type: 'clickhouse',
  connectionConfig: {},
  tableMapping: [],
}

const defaultResources: ResourceConfig = {
  maxBatchSize: 1000,
  maxDelayTime: '1m',
}

export const initialDomain: PipelineDomain = {
  id: undefined,
  name: '',
  sources: [],
  transforms: [],
  sink: defaultSink,
  resources: defaultResources,
}

// ─── Slice types ──────────────────────────────────────────────────────────────

export interface DomainStoreState {
  domain: PipelineDomain
  isDirty: boolean
}

export interface DomainStoreActions {
  setDomain: (domain: PipelineDomain) => void
  updateSources: (sources: SourceConfig[]) => void
  updateTransforms: (transforms: TransformConfig[]) => void
  updateSink: (sink: SinkConfig) => void
  updateResources: (resources: ResourceConfig) => void
  markDirty: () => void
  markClean: () => void

  /**
   * Derives the wire format from the domain.
   * Replaces `coreStore.apiConfig` as the single source of truth for what goes to the backend.
   * @deprecated `coreStore.apiConfig` — use `domainStore.toWireFormat()` instead.
   */
  toWireFormat: () => InternalPipelineConfig

  /**
   * Builds the domain from current wizard slice stores.
   * This is the bridge that keeps the wizard working without rewriting it.
   * Call after any `hydrateSection()` completes.
   */
  syncFromSlices: () => void

  /**
   * Returns the effective schema after all active transforms (uses A5 plugin chain).
   */
  getSchema: () => SchemaField[]

  validate: () => { valid: boolean; errors: string[] }

  reset: () => void
}

export interface DomainSlice {
  domainStore: DomainStoreState & DomainStoreActions
}

// ─── Slice factory ────────────────────────────────────────────────────────────

export const createDomainSlice: StateCreator<DomainSlice> = (set, get) => ({
  domainStore: {
    domain: { ...initialDomain },
    isDirty: false,

    setDomain: (domain: PipelineDomain) =>
      set((state) => ({
        domainStore: { ...state.domainStore, domain, isDirty: true },
      })),

    updateSources: (sources: SourceConfig[]) =>
      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain: { ...state.domainStore.domain, sources },
          isDirty: true,
        },
      })),

    updateTransforms: (transforms: TransformConfig[]) =>
      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain: { ...state.domainStore.domain, transforms },
          isDirty: true,
        },
      })),

    updateSink: (sink: SinkConfig) =>
      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain: { ...state.domainStore.domain, sink },
          isDirty: true,
        },
      })),

    updateResources: (resources: ResourceConfig) =>
      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain: { ...state.domainStore.domain, resources },
          isDirty: true,
        },
      })),

    markDirty: () =>
      set((state) => ({ domainStore: { ...state.domainStore, isDirty: true } })),

    markClean: () =>
      set((state) => ({ domainStore: { ...state.domainStore, isDirty: false } })),

    // ── toWireFormat ─────────────────────────────────────────────────────────
    toWireFormat: (): InternalPipelineConfig => {
      const { domain } = get().domainStore

      // Resolve pipeline ID — generate a stable one if absent
      const pipelineId = domain.id ?? uuidv4()

      // ── Source ──
      const firstSource = domain.sources[0]
      const sourceType = firstSource?.type ?? 'kafka'
      const sourceAdapter = getSourceAdapter(sourceType)

      // Build source wire shape using the adapter (Kafka vs OTLP)
      // When domain.sources is populated the adapter's toWireSource receives a
      // synthetic store snapshot built from domain fields.
      const wireSourceResult = sourceAdapter.toWireSource({
        kafkaStore: buildKafkaStoreSnapshot(domain),
        topicsStore: buildTopicsStoreSnapshot(domain),
        deduplicationStore: buildDeduplicationStoreSnapshot(domain),
        coreStore: { sourceType },
        otlpStore: buildOtlpStoreSnapshot(domain),
      })
      const finalSource = wireSourceResult.source

      // ── Transforms ──
      const activeTransforms = domain.transforms.filter((t) => t.enabled)

      const dedup = activeTransforms.find((t) => t.type === 'deduplication')
      const filter = activeTransforms.find((t) => t.type === 'filter')
      const stateless = activeTransforms.find((t) => t.type === 'stateless')
      const join = activeTransforms.find((t) => t.type === 'join')

      // ── Sink ──
      const { connectionConfig, tableMapping } = domain.sink
      const cc = connectionConfig as Record<string, unknown>

      // ── Resources ──
      const { maxBatchSize, maxDelayTime } = domain.resources

      const config: InternalPipelineConfig = {
        pipeline_id: pipelineId,
        name: domain.name,
        source: finalSource as InternalPipelineConfig['source'],
        join: join && join.enabled
          ? (join.config as InternalPipelineConfig['join'])
          : { enabled: false },
        sink: {
          type: 'clickhouse',
          host: (cc.host as string) ?? '',
          httpPort: (cc.httpPort as string) ?? (cc.http_port as string) ?? '',
          nativePort: (cc.nativePort as string) ?? (cc.port as string) ?? undefined,
          database: (cc.database as string) ?? '',
          username: (cc.username as string) ?? undefined,
          password: (cc.password as string) ?? undefined,
          table: (cc.table as string) ?? '',
          secure: (cc.secure as boolean) ?? false,
          table_mapping: tableMapping.map((m) => ({
            source_id: firstSource?.id ?? '',
            field_name: m.sourceField,
            column_name: m.targetColumn,
            column_type: m.columnType,
          })),
          max_batch_size: maxBatchSize,
          max_delay_time: maxDelayTime,
          skip_certificate_verification: (cc.skip_certificate_verification as boolean) ?? false,
        },
        ...(filter && filter.enabled
          ? {
              filter: {
                enabled: true,
                expression: (filter.config.expression as string) ?? '',
              },
            }
          : { filter: { enabled: false, expression: '' } }),
        ...(stateless && stateless.enabled
          ? {
              transformation: {
                enabled: true,
                expression: (stateless.config.expression as string) ?? '',
                fields: (stateless.config.fields as unknown[]) ?? [],
              },
            }
          : { transformation: { enabled: false, expression: '', fields: [] } }),
        ...(dedup
          ? {} // dedup is embedded in source topics / wire source
          : {}),
      }

      return config
    },

    // ── syncFromSlices ────────────────────────────────────────────────────────
    syncFromSlices: () => {
      // Lazy import avoids circular dependency at module-evaluation time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useStore } = require('./index') as typeof import('./index')
      const root = useStore.getState()

      const {
        coreStore,
        kafkaStore,
        topicsStore,
        deduplicationStore,
        joinStore,
        filterStore,
        transformationStore,
        clickhouseConnectionStore,
        clickhouseDestinationStore,
        resourcesStore,
        otlpStore,
      } = root

      // ── Sources ──
      const sourceType = (coreStore.sourceType ?? 'kafka') as
        | 'kafka'
        | 'otlp.logs'
        | 'otlp.traces'
        | 'otlp.metrics'
      const isOtlp = getSourceAdapter(sourceType).type !== 'kafka'

      const otlpSourceType = sourceType as 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'
      const sources: SourceConfig[] = isOtlp
        ? buildOtlpSources(otlpSourceType, otlpStore)
        : buildKafkaSources(kafkaStore, topicsStore, deduplicationStore)

      // ── Transforms ──
      const transforms: TransformConfig[] = []

      // Deduplication — handled per-topic for Kafka, single for OTLP
      if (isOtlp && otlpStore.deduplication?.enabled) {
        transforms.push({
          type: 'deduplication',
          enabled: true,
          config: otlpStore.deduplication as unknown as Record<string, unknown>,
        })
      } else {
        // For Kafka, deduplication is embedded in each source's config (per-topic)
        // but we also track it at the top-level transform list for the domain model
        const dedupConfigs = deduplicationStore.deduplicationConfigs
        const hasAnyDedup = Object.values(dedupConfigs).some(
          (c) => c && c.enabled && c.key?.trim(),
        )
        if (hasAnyDedup) {
          transforms.push({
            type: 'deduplication',
            enabled: true,
            config: dedupConfigs as unknown as Record<string, unknown>,
          })
        }
      }

      // Join
      if (joinStore.enabled) {
        transforms.push({
          type: 'join',
          enabled: true,
          config: {
            type: joinStore.type,
            streams: joinStore.streams,
          } as Record<string, unknown>,
        })
      }

      // Filter
      if (filterStore?.filterConfig?.enabled && filterStore?.expressionString) {
        transforms.push({
          type: 'filter',
          enabled: true,
          config: {
            expression: filterStore.expressionString,
            filterConfig: filterStore.filterConfig,
          } as Record<string, unknown>,
        })
      }

      // Stateless transformation
      if (
        transformationStore?.transformationConfig?.enabled &&
        transformationStore.transformationConfig.fields?.length > 0
      ) {
        transforms.push({
          type: 'stateless',
          enabled: true,
          config: {
            expression: transformationStore.expressionString ?? '',
            fields: transformationStore.transformationConfig.fields,
          } as Record<string, unknown>,
        })
      }

      // ── Sink ──
      const { clickhouseConnection } = clickhouseConnectionStore
      const { clickhouseDestination } = clickhouseDestinationStore
      const dc = clickhouseConnection?.directConnection ?? {}

      const tableMapping = (clickhouseDestination?.mapping ?? [])
        .filter((m: Record<string, unknown>) => m.eventField && !String(m.eventField).startsWith('_metadata'))
        .map((m: Record<string, unknown>) => ({
          sourceField: m.eventField as string,
          targetColumn: m.name as string,
          columnType: m.type as string,
        }))

      const sink: SinkConfig = {
        type: 'clickhouse',
        connectionConfig: {
          host: dc.host ?? '',
          httpPort: dc.httpPort ?? '',
          nativePort: dc.nativePort ?? '',
          database: clickhouseDestination?.database ?? '',
          username: dc.username ?? '',
          password: dc.password ?? '',
          table: clickhouseDestination?.table ?? '',
          secure: dc.useSSL ?? false,
          skip_certificate_verification: dc.skipCertificateVerification ?? false,
        },
        tableMapping,
      }

      // ── Resources ──
      const dest = clickhouseDestination ?? {}
      const delayTime = dest.maxDelayTime ?? 1
      const delayUnit = dest.maxDelayTimeUnit ?? 'm'
      const resources: ResourceConfig = {
        maxBatchSize: dest.maxBatchSize ?? 1000,
        maxDelayTime: `${delayTime}${delayUnit.charAt(0)}`,
      }

      // ── Assemble domain ──
      const domain: PipelineDomain = {
        id: coreStore.pipelineId || undefined,
        name: coreStore.pipelineName,
        sources,
        transforms,
        sink,
        resources,
      }

      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain,
          isDirty: coreStore.isDirty,
        },
      }))
    },

    // ── getSchema ─────────────────────────────────────────────────────────────
    getSchema: (): SchemaField[] => {
      const { domain } = get().domainStore

      // Base schema from first source
      const baseSchema: SchemaField[] = (domain.sources[0]?.schemaFields ?? [])

      // Active transforms in order (filter and stateless only — dedup/join don't change the schema shape)
      const activeTransforms = domain.transforms
        .filter((t) => t.enabled && (t.type === 'filter' || t.type === 'stateless'))
        .map((t) => ({ type: t.type as 'filter' | 'stateless', config: t.config }))

      if (activeTransforms.length === 0) return baseSchema

      // Lazy import to break circular dependency: schema-service → store/index → domain.store
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getEffectiveSchemaFromPlugins } = require('@/src/utils/schema-service') as typeof import('@/src/utils/schema-service')
      return getEffectiveSchemaFromPlugins(baseSchema, activeTransforms)
    },

    // ── validate ─────────────────────────────────────────────────────────────
    validate: (): { valid: boolean; errors: string[] } => {
      const { domain } = get().domainStore
      const errors: string[] = []

      if (!domain.name || domain.name.trim() === '') {
        errors.push('Pipeline name is required')
      }

      if (!domain.id && domain.id !== undefined) {
        // undefined means not-yet-assigned (ok); empty string is invalid
        errors.push('Pipeline ID must not be empty when set')
      }

      if (domain.sources.length === 0) {
        errors.push('At least one source is required')
      }

      if (!domain.sink.connectionConfig || Object.keys(domain.sink.connectionConfig).length === 0) {
        errors.push('Sink connection configuration is required')
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    },

    // ── reset ─────────────────────────────────────────────────────────────────
    reset: () =>
      set((state) => ({
        domainStore: {
          ...state.domainStore,
          domain: { ...initialDomain },
          isDirty: false,
        },
      })),
  },
})

// ─── Private helpers for syncFromSlices ──────────────────────────────────────

function buildKafkaSources(
  kafkaStore: { bootstrapServers?: string; authMethod?: string; securityProtocol?: string },
  topicsStore: { topics: Record<number, { name?: string; schema?: { fields?: Array<{ name: string; type?: string; userType?: string; isRemoved?: boolean }> } }> },
  deduplicationStore: { deduplicationConfigs: Record<number, { enabled: boolean; key: string; keyType: string; window: number; unit: string }> },
): SourceConfig[] {
  const topicEntries = Object.entries(topicsStore.topics ?? {})
  if (topicEntries.length === 0) return []

  return topicEntries.map(([idxStr, topic]) => {
    const idx = parseInt(idxStr, 10)
    const rawFields = topic?.schema?.fields ?? []
    const schemaFields: SchemaField[] = rawFields
      .filter((f) => !f.isRemoved)
      .map((f) => ({
        name: f.name,
        type: normalizeFieldType(f.userType ?? f.type ?? 'string'),
        nullable: false,
        source: 'topic' as const,
        originalType: f.userType ?? f.type ?? 'string',
      }))

    const dedupConfig = deduplicationStore.deduplicationConfigs[idx]

    return {
      type: 'kafka' as const,
      id: topic?.name ?? '',
      connectionConfig: {
        bootstrapServers: kafkaStore.bootstrapServers ?? '',
        authMethod: kafkaStore.authMethod ?? 'NO_AUTH',
        securityProtocol: kafkaStore.securityProtocol ?? 'PLAINTEXT',
        deduplication: dedupConfig ?? null,
      },
      schemaFields,
    }
  })
}

function buildOtlpSources(
  sourceType: 'otlp.logs' | 'otlp.traces' | 'otlp.metrics',
  otlpStore: { sourceId?: string; schemaFields?: Array<{ name: string; type: string }> },
): SourceConfig[] {
  const schemaFields: SchemaField[] = (otlpStore.schemaFields ?? []).map((f) => ({
    name: f.name,
    type: normalizeFieldType(f.type),
    nullable: false,
    source: 'topic' as const,
    originalType: f.type,
  }))

  return [
    {
      type: sourceType,
      id: otlpStore.sourceId ?? '',
      connectionConfig: {},
      schemaFields,
    },
  ]
}

// ─── Private helpers for toWireFormat ────────────────────────────────────────
// These build minimal store snapshots that the source adapters expect.

function buildKafkaStoreSnapshot(domain: PipelineDomain): Record<string, unknown> {
  const firstSource = domain.sources[0]
  if (!firstSource || firstSource.type !== 'kafka') return {}
  const cc = firstSource.connectionConfig as Record<string, unknown>
  return {
    bootstrapServers: cc.bootstrapServers ?? '',
    authMethod: cc.authMethod ?? 'NO_AUTH',
    securityProtocol: cc.securityProtocol ?? 'PLAINTEXT',
  }
}

function buildTopicsStoreSnapshot(domain: PipelineDomain): Record<string, unknown> {
  const kafkaSources = domain.sources.filter((s) => s.type === 'kafka')
  return {
    selectedTopics: kafkaSources.map((s) => ({
      name: s.id,
      schema: {
        fields: s.schemaFields.map((f) => ({
          name: f.name,
          type: f.originalType ?? f.type,
          userType: f.type,
        })),
      },
    })),
  }
}

function buildDeduplicationStoreSnapshot(domain: PipelineDomain): Record<string, unknown> {
  const dedupTransform = domain.transforms.find((t) => t.type === 'deduplication')
  if (!dedupTransform) {
    return {
      getDeduplication: (_idx: number) => null,
      deduplicationConfigs: {},
    }
  }
  const configs = dedupTransform.config as Record<number, unknown>
  return {
    getDeduplication: (idx: number) => (configs[idx] ?? null),
    deduplicationConfigs: configs,
  }
}

function buildOtlpStoreSnapshot(domain: PipelineDomain): Record<string, unknown> {
  const otlpSource = domain.sources.find((s) => s.type !== 'kafka')
  if (!otlpSource) return { sourceId: '', schemaFields: [], deduplication: { enabled: false } }
  const dedupTransform = domain.transforms.find((t) => t.type === 'deduplication')
  return {
    sourceId: otlpSource.id,
    schemaFields: otlpSource.schemaFields,
    deduplication: dedupTransform?.config ?? { enabled: false },
    signalType: otlpSource.type,
  }
}
