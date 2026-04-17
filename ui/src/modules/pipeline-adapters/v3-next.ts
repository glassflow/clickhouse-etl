/**
 * V3-Next Pipeline Adapter
 *
 * Handles the proposed next evolution of the v3 API format.
 * NOT yet active — the current backend still uses the v3 format.
 * Registered in the factory under the "v3-next" key so it can be
 * exercised in tests and activated with a one-line factory change
 * when the backend ships the new format.
 *
 * Key structural differences from v3:
 *   - sources[]         (was: source + topics[])   — one entry per Kafka topic, each with its own source_id
 *   - transforms[]      (was: filter, stateless_transformation, per-topic deduplication)
 *   - join.left_source / join.right_source + join.output_fields[]  (was: join.sources[] with orientation)
 *   - resources.sources[] + resources.transform[]  (was: pipeline_resources.ingestor.{base,left,right})
 *
 * The internal format (InternalPipelineConfig) is unchanged — only the API ↔ internal translation differs.
 */

import { PipelineAdapter } from './types'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'
import { toTransformArray } from '@/src/modules/transformation/utils'
import { mapTransformToField } from './v3'

export class V3NextPipelineAdapter implements PipelineAdapter {
  version = PipelineVersion.V3_NEXT

  hydrate(apiConfig: any): InternalPipelineConfig {
    const config = JSON.parse(JSON.stringify(apiConfig)) as any

    const sources: any[] = Array.isArray(config.sources) ? config.sources : []
    const transforms: any[] = Array.isArray(config.transforms) ? config.transforms : []
    const joinCfg = config.join ?? {}

    // ── 1. sources[] → internal source ──────────────────────────────────────
    const otlpSources = sources.filter((s: any) => typeof s.type === 'string' && s.type.startsWith('otlp.'))
    const kafkaSources = sources.filter((s: any) => !otlpSources.includes(s))

    let internalSource: any
    if (otlpSources.length > 0) {
      internalSource = { type: otlpSources[0].type, id: otlpSources[0].source_id }
    } else {
      internalSource = {
        type: 'kafka',
        ...(kafkaSources[0]?.provider ? { provider: kafkaSources[0].provider } : {}),
        connection_params: kafkaSources[0]?.connection_params ?? {},
        topics: kafkaSources.map((s: any) => ({
          id: s.source_id,
          name: s.topic ?? s.source_id,
          consumer_group_initial_offset: s.consumer_group_initial_offset ?? 'latest',
          schema: {
            type: 'json',
            fields: (s.schema_fields ?? []).map((f: any) => ({ name: f.name, type: f.type ?? 'string' })),
          },
          // deduplication default; overwritten below if a dedup transform exists for this source
          deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' },
          ...(s.schema_version != null ? { schema_version: s.schema_version } : {}),
          ...(s.schema_registry != null ? { schema_registry: s.schema_registry } : {}),
        })),
      }
    }

    // ── 2. transforms[] → dedup per topic/source, filter, transformation ─────
    let filterConfig: any = { enabled: false, expression: '' }
    let internalTransformation: any = { enabled: false, expression: '', fields: [] }

    for (const t of transforms) {
      switch (t.type) {
        case 'dedup': {
          if (otlpSources.length > 0) {
            internalSource.deduplication = {
              enabled: true,
              key: t.config?.key ?? '',
              time_window: t.config?.time_window ?? '1h',
            }
          } else {
            const topic = internalSource.topics?.find((tp: any) => tp.id === t.source_id)
            if (topic) {
              topic.deduplication = {
                enabled: true,
                id_field: t.config?.key ?? '',
                id_field_type: 'string',
                time_window: t.config?.time_window ?? '1h',
              }
            }
          }
          break
        }
        case 'filter': {
          filterConfig = { enabled: true, expression: t.config?.expression ?? '' }
          break
        }
        case 'stateless': {
          const tfArray: any[] = t.config?.transforms ?? []
          internalTransformation = {
            enabled: true,
            expression: '',
            fields: tfArray.map((tf: any, idx: number) => mapTransformToField(tf, idx)),
            source_id: t.source_id,
          }
          break
        }
      }
    }

    // ── 3. join.left_source / right_source → join.sources[] with orientation ─
    let internalJoin: any
    if (joinCfg.enabled) {
      const joinSources: any[] = []
      if (joinCfg.left_source) {
        joinSources.push({
          source_id: joinCfg.left_source.source_id,
          join_key: joinCfg.left_source.key,
          time_window: joinCfg.left_source.time_window,
          orientation: 'left',
        })
      }
      if (joinCfg.right_source) {
        joinSources.push({
          source_id: joinCfg.right_source.source_id,
          join_key: joinCfg.right_source.key,
          time_window: joinCfg.right_source.time_window,
          orientation: 'right',
        })
      }
      internalJoin = {
        type: joinCfg.type ?? 'temporal',
        enabled: true,
        ...(joinCfg.id ? { id: joinCfg.id } : {}),
        sources: joinSources,
      }
    } else {
      internalJoin = { type: 'temporal', enabled: false, sources: [] }
    }

    // ── 4. sink: connection_params → flat, mapping → table_mapping ────────────
    let internalSink: any = {}
    if (config.sink) {
      const s = config.sink
      const cp = s.connection_params ?? {}
      const sourceId = s.source_id
      internalSink = {
        type: s.type ?? 'clickhouse',
        host: cp.host ?? s.host ?? '',
        http_port: cp.http_port ?? s.http_port ?? '8123',
        port: cp.port ?? s.port ?? '9000',
        database: cp.database ?? s.database ?? 'default',
        username: cp.username ?? s.username ?? '',
        password: cp.password ?? s.password ?? '',
        secure: cp.secure ?? s.secure ?? false,
        ...(cp.skip_certificate_verification != null
          ? { skip_certificate_verification: cp.skip_certificate_verification }
          : s.skip_certificate_verification != null
            ? { skip_certificate_verification: s.skip_certificate_verification }
            : {}),
        table: s.table ?? '',
        max_batch_size: s.max_batch_size ?? 1000,
        max_delay_time: s.max_delay_time ?? '1s',
        table_mapping: Array.isArray(s.mapping)
          ? s.mapping.map((m: any) => ({
              source_id: sourceId ?? '',
              field_name: m.name,
              column_name: m.column_name,
              column_type: m.column_type,
            }))
          : [],
      }
    }

    // ── 5. resources.sources[] + resources.transform[] → pipeline_resources ──
    let pipelineResources: any = undefined
    if (config.resources) {
      const r = config.resources
      pipelineResources = {}
      if (r.nats) pipelineResources.nats = r.nats
      if (r.sink) pipelineResources.sink = r.sink

      const srcRes: any[] = Array.isArray(r.sources) ? r.sources : []
      if (srcRes.length > 0) {
        if (joinCfg.enabled) {
          const leftId = joinCfg.left_source?.source_id
          const rightId = joinCfg.right_source?.source_id
          const leftR = srcRes.find((s: any) => s.source_id === leftId)
          const rightR = srcRes.find((s: any) => s.source_id === rightId)
          pipelineResources.ingestor = {
            ...(leftR ? { left: { requests: leftR.requests, limits: leftR.limits, replicas: leftR.replicas } } : {}),
            ...(rightR ? { right: { requests: rightR.requests, limits: rightR.limits, replicas: rightR.replicas } } : {}),
          }
        } else {
          const base = srcRes[0]
          pipelineResources.ingestor = {
            base: { requests: base.requests, limits: base.limits, replicas: base.replicas },
          }
        }
      }

      const transformRes: any[] = Array.isArray(r.transform) ? r.transform : []
      if (transformRes.length > 0) {
        const t = transformRes[0]
        pipelineResources.transform = { requests: t.requests, limits: t.limits, replicas: t.replicas, storage: t.storage }
      }
    }

    return {
      pipeline_id: config.pipeline_id,
      name: config.name,
      version: this.version,
      source: internalSource,
      join: internalJoin,
      filter: filterConfig,
      transformation: internalTransformation,
      sink: internalSink,
      ...(pipelineResources != null ? { pipeline_resources: pipelineResources } : {}),
      ...(config.metadata != null ? { metadata: config.metadata } : {}),
    } as InternalPipelineConfig
  }

  generate(internalConfig: InternalPipelineConfig): any {
    const cfg = internalConfig
    const topics = (cfg.source?.topics ?? []) as any[]
    const join = cfg.join as any
    const transformation = cfg.transformation as any
    const filter = cfg.filter
    const isOtlp = (cfg.source?.type ?? '').startsWith('otlp.')

    const output: any = {
      version: this.version,
      pipeline_id: cfg.pipeline_id,
      name: cfg.name,
    }

    // ── 1. source → sources[] ─────────────────────────────────────────────────
    if (isOtlp) {
      output.sources = [{ type: cfg.source.type, source_id: (cfg.source as any).id ?? 'source' }]
    } else {
      output.sources = topics.map((t: any) => ({
        type: 'kafka',
        source_id: t.id ?? t.name,
        connection_params: cfg.source?.connection_params,
        ...(cfg.source?.provider ? { provider: cfg.source.provider } : {}),
        topic: t.name,
        consumer_group_initial_offset: t.consumer_group_initial_offset ?? 'latest',
        schema_fields: (t.schema?.fields ?? []).map((f: any) => ({ name: f.name, type: f.type ?? 'string' })),
        schema_version: t.schema_version ?? '1',
        schema_registry: t.schema_registry ?? { url: '', api_key: '', api_secret: '' },
      }))
    }

    // ── 2. dedup / filter / transformation → transforms[] ────────────────────
    const transforms: any[] = []

    // dedup from topics
    if (!isOtlp) {
      for (const t of topics) {
        if (t.deduplication?.enabled && t.deduplication?.id_field) {
          transforms.push({
            type: 'dedup',
            source_id: t.id ?? t.name,
            config: { key: t.deduplication.id_field, time_window: t.deduplication.time_window ?? '1h' },
          })
        }
      }
    } else {
      const otlpDedup = (cfg.source as any)?.deduplication
      if (otlpDedup?.enabled && otlpDedup?.key) {
        transforms.push({
          type: 'dedup',
          source_id: (cfg.source as any)?.id ?? 'source',
          config: { key: otlpDedup.key, time_window: otlpDedup.time_window ?? '1h' },
        })
      }
    }

    // filter
    if (filter?.enabled) {
      const srcId = isOtlp
        ? ((cfg.source as any)?.id ?? 'source')
        : (topics[0]?.id ?? topics[0]?.name ?? 'source')
      transforms.push({ type: 'filter', source_id: srcId, config: { expression: filter.expression ?? '' } })
    }

    // stateless transformation
    if (transformation?.enabled && (transformation?.fields?.length ?? 0) > 0) {
      const baseName = (cfg.name ?? cfg.pipeline_id ?? 'transform')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-transform$/, '')
      const srcId =
        transformation.source_id ??
        (isOtlp ? ((cfg.source as any)?.id ?? 'source') : (topics[0]?.id ?? topics[0]?.name ?? 'source'))
      transforms.push({
        type: 'stateless',
        id: `${baseName}-transform`,
        source_id: srcId,
        config: { transforms: toTransformArray({ enabled: true, fields: transformation.fields }) },
      })
    }

    if (transforms.length > 0) output.transforms = transforms

    // ── 3. join.sources[] → left_source / right_source + output_fields ────────
    if (join?.enabled && Array.isArray(join?.sources)) {
      const left = join.sources.find((s: any) => s.orientation === 'left')
      const right = join.sources.find((s: any) => s.orientation === 'right')
      const tableMapping: any[] = (cfg.sink as any)?.table_mapping ?? []
      const seen = new Set<string>()
      const outputFields: any[] = []
      for (const m of tableMapping) {
        const key = `${m.source_id}:${m.field_name}`
        if (!seen.has(key)) {
          seen.add(key)
          outputFields.push({ source_id: m.source_id, name: m.field_name, output_name: m.field_name })
        }
      }
      output.join = {
        enabled: true,
        type: join.type ?? 'temporal',
        ...(join.id ? { id: join.id } : {}),
        ...(left ? { left_source: { source_id: left.source_id, key: left.join_key, time_window: left.time_window } } : {}),
        ...(right ? { right_source: { source_id: right.source_id, key: right.join_key, time_window: right.time_window } } : {}),
        ...(outputFields.length > 0 ? { output_fields: outputFields } : {}),
      }
    } else {
      output.join = { enabled: false }
    }

    // ── 4. sink: flat → connection_params, table_mapping → mapping ────────────
    if (cfg.sink) {
      const s = cfg.sink as any
      let sinkSrcId: string
      if (transformation?.enabled && (transformation?.fields?.length ?? 0) > 0) {
        const baseName = (cfg.name ?? cfg.pipeline_id ?? 'transform')
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-transform$/, '')
        sinkSrcId = `${baseName}-transform`
      } else if (join?.enabled) {
        sinkSrcId = join.id ?? topics[0]?.id ?? 'source'
      } else {
        sinkSrcId = isOtlp
          ? ((cfg.source as any)?.id ?? 'source')
          : (topics[0]?.id ?? topics[0]?.name ?? 'source')
      }
      output.sink = {
        type: s.type ?? 'clickhouse',
        connection_params: {
          host: s.host ?? '',
          port: s.port ?? '9000',
          http_port: s.http_port ?? s.httpPort ?? '8123',
          database: s.database ?? 'default',
          username: s.username ?? '',
          password: s.password ?? '',
          secure: s.secure ?? false,
          ...(s.skip_certificate_verification != null
            ? { skip_certificate_verification: s.skip_certificate_verification }
            : {}),
        },
        table: s.table,
        ...(s.engine ? { engine: s.engine } : {}),
        ...(s.order_by ? { order_by: s.order_by } : {}),
        max_batch_size: s.max_batch_size ?? 1000,
        max_delay_time: s.max_delay_time ?? '1s',
        source_id: s.source_id ?? sinkSrcId,
        mapping: (s.table_mapping ?? []).map((m: any) => ({
          name: m.field_name,
          column_name: m.column_name,
          column_type: m.column_type,
        })),
      }
    }

    // ── 5. pipeline_resources → resources.sources[] + resources.transform[] ──
    const pr = cfg.pipeline_resources
    if (pr) {
      const resources: any = {}
      if (pr.nats) resources.nats = pr.nats

      const hasJoin = join?.enabled
      const sourcesOut: any[] = []

      if (pr.ingestor) {
        if (hasJoin) {
          const left = join?.sources?.find((s: any) => s.orientation === 'left')
          const right = join?.sources?.find((s: any) => s.orientation === 'right')
          if (left && pr.ingestor.left) sourcesOut.push({ source_id: left.source_id, ...pr.ingestor.left })
          if (right && pr.ingestor.right) sourcesOut.push({ source_id: right.source_id, ...pr.ingestor.right })
        } else if (pr.ingestor.base) {
          const srcId = isOtlp
            ? ((cfg.source as any)?.id ?? 'source')
            : (topics[0]?.id ?? topics[0]?.name ?? 'source')
          sourcesOut.push({ source_id: srcId, ...pr.ingestor.base })
        }
      }

      if (sourcesOut.length > 0) resources.sources = sourcesOut

      if (pr.transform) {
        const srcId = isOtlp
          ? ((cfg.source as any)?.id ?? 'source')
          : (topics[0]?.id ?? topics[0]?.name ?? 'source')
        resources.transform = [{ source_id: srcId, ...pr.transform }]
      }

      if (pr.sink) resources.sink = pr.sink
      output.resources = resources
    }

    if (cfg.metadata) output.metadata = cfg.metadata

    return output
  }
}
