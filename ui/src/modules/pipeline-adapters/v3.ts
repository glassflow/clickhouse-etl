import { PipelineAdapter } from './types'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'
import { toTransformArray, exprToFieldName } from '@/src/modules/transformation/utils'

export class V3PipelineAdapter implements PipelineAdapter {
  version = PipelineVersion.V3

  hydrate(apiConfig: any): InternalPipelineConfig {
    const internalConfig = JSON.parse(JSON.stringify(apiConfig)) as any

    // 1. Source topics: schema_fields -> schema.fields, deduplication.key -> id_field
    if (internalConfig.source?.topics) {
      internalConfig.source.topics.forEach((topic: any) => {
        if (Array.isArray(topic.schema_fields)) {
          topic.schema = {
            type: 'json',
            fields: topic.schema_fields.map((f: any) => ({ name: f.name, type: f.type || 'string' })),
          }
          delete topic.schema_fields
        }
        if (topic.deduplication) {
          if (topic.deduplication.key !== undefined) {
            topic.deduplication.id_field = topic.deduplication.key
            delete topic.deduplication.key
          }
          if (topic.deduplication.id_field_type === undefined) {
            topic.deduplication.id_field_type = 'string'
          }
        }
      })
    }

    // 2. Sink: connection_params -> flat; mapping + source_id -> table_mapping
    if (internalConfig.sink) {
      const sink = internalConfig.sink
      const cp = sink.connection_params || {}
      sink.host = cp.host ?? sink.host
      sink.http_port = cp.http_port ?? sink.http_port
      sink.port = cp.port ?? sink.port
      sink.database = cp.database ?? sink.database
      sink.username = cp.username ?? sink.username
      sink.password = cp.password ?? sink.password
      sink.secure = cp.secure ?? sink.secure
      if (cp.skip_certificate_verification !== undefined) {
        sink.skip_certificate_verification = cp.skip_certificate_verification
      }
      delete sink.connection_params

      const sourceId = sink.source_id
      if (Array.isArray(sink.mapping)) {
        sink.table_mapping = sink.mapping.map((m: any) => ({
          source_id: sourceId,
          field_name: m.name,
          column_name: m.column_name,
          column_type: m.column_type,
        }))
        delete sink.mapping
      }
      // Keep sink.source_id for generate (internal shape allows extra props)
    }

    // 3. Join: sources[].key -> join_key
    if (internalConfig.join?.enabled && Array.isArray(internalConfig.join.sources)) {
      internalConfig.join.sources.forEach((src: any) => {
        if (src.key !== undefined) {
          src.join_key = src.key
          delete src.key
        }
      })
      // join.fields not needed for internal; hydration only uses sources[].join_key
    }

    // 4. Stateless transformation -> transformation (reuse V2-style logic)
    const statelessTransformation = apiConfig.stateless_transformation
    if (statelessTransformation) {
      if (statelessTransformation.enabled && statelessTransformation.config?.transform) {
        const transformArray = statelessTransformation.config.transform || []
        const fields = transformArray.map((transform: any, index: number) =>
          this.mapTransformToField(transform, index),
        )
        internalConfig.transformation = {
          enabled: true,
          expression: '',
          fields,
          ...(statelessTransformation.source_id != null && {
            source_id: statelessTransformation.source_id,
          }),
        }
      } else if (!statelessTransformation.enabled) {
        internalConfig.transformation = {
          enabled: false,
          expression: '',
          fields: [],
        }
      }
      delete internalConfig.stateless_transformation
    }

    // 5. Filter unchanged
    // 6. No root schema in V3
    delete internalConfig.schema

    internalConfig.version = this.version
    return internalConfig as InternalPipelineConfig
  }

  private mapTransformToField(transform: any, index: number): any {
    const expression = transform.expression || ''
    const outputName = transform.output_name || ''
    const outputType = transform.output_type || 'string'
    const fieldNameFromExpr = exprToFieldName(expression)
    const isPassthrough = fieldNameFromExpr !== null

    if (isPassthrough) {
      return {
        id: `field-${index}`,
        type: 'passthrough',
        outputFieldName: outputName,
        outputFieldType: outputType,
        sourceField: fieldNameFromExpr,
        sourceFieldType: outputType,
      }
    }

    const functionMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.+)\)$/)
    if (functionMatch) {
      const functionName = functionMatch[1]
      const argsString = functionMatch[2]
      const args: any[] = []
      const argParts = this.parseFunctionArgs(argsString)
      argParts.forEach((arg: string) => {
        const trimmed = arg.trim()
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          args.push({ type: 'literal', value: trimmed.slice(1, -1), literalType: 'string' })
        } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          const arrayContent = trimmed.slice(1, -1)
          const arrayValues = this.parseFunctionArgs(arrayContent).map((v: string) =>
            v.trim().replace(/^"|"$/g, ''),
          )
          args.push({ type: 'array', values: arrayValues, elementType: 'string' })
        } else if (/^-?\d+$/.test(trimmed)) {
          args.push({
            type: 'literal',
            value: parseInt(trimmed, 10),
            literalType: 'number',
          })
        } else {
          args.push({
            type: 'field',
            fieldName: exprToFieldName(trimmed) ?? trimmed,
            fieldType: 'string',
          })
        }
      })
      return {
        id: `field-${index}`,
        type: 'computed',
        outputFieldName: outputName,
        outputFieldType: outputType,
        functionName: functionName,
        functionArgs: args,
      }
    }

    return {
      id: `field-${index}`,
      type: 'computed',
      outputFieldName: outputName,
      outputFieldType: outputType,
      functionName: '__raw_expression__',
      functionArgs: [{ type: 'literal', value: expression, literalType: 'string' }],
      rawExpression: expression,
    }
  }

  private parseFunctionArgs(argsString: string): string[] {
    const args: string[] = []
    let current = ''
    let depth = 0
    let inString = false
    let stringChar = ''

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i]
      if ((char === '"' || char === "'") && (i === 0 || argsString[i - 1] !== '\\')) {
        if (!inString) {
          inString = true
          stringChar = char
          current += char
        } else if (char === stringChar) {
          inString = false
          stringChar = ''
          current += char
        } else {
          current += char
        }
      } else if (!inString) {
        if (char === '(' || char === '[') {
          depth++
          current += char
        } else if (char === ')' || char === ']') {
          depth--
          current += char
        } else if (char === ',' && depth === 0) {
          args.push(current.trim())
          current = ''
        } else {
          current += char
        }
      } else {
        current += char
      }
    }
    if (current.trim()) args.push(current.trim())
    return args
  }

  generate(internalConfig: InternalPipelineConfig): any {
    const apiConfig = JSON.parse(JSON.stringify(internalConfig)) as any

    // 1. Source topics: schema.fields -> schema_fields, id_field -> key, add schema_version/schema_registry
    if (apiConfig.source?.topics) {
      apiConfig.source.topics.forEach((topic: any) => {
        if (topic.schema?.fields) {
          topic.schema_fields = topic.schema.fields.map((f: any) => ({
            name: f.name,
            type: f.type || 'string',
          }))
          delete topic.schema
        }
        if (topic.deduplication) {
          if (topic.deduplication.id_field !== undefined) {
            topic.deduplication.key = topic.deduplication.id_field
            delete topic.deduplication.id_field
          }
          delete topic.deduplication.id_field_type
        }
        if (topic.schema_version === undefined) topic.schema_version = '1'
        if (topic.schema_registry === undefined) {
          topic.schema_registry = { url: '', api_key: '', api_secret: '' }
        }
      })
    }

    // 2. Sink: flat -> connection_params; table_mapping -> mapping; set source_id
    const topics = internalConfig.source?.topics || []
    const transformation = internalConfig.transformation
    const join = internalConfig.join
    const hasTransform =
      Boolean(transformation?.enabled && transformation?.fields?.length)
    const hasJoin = Boolean(join?.enabled && join?.sources?.length)
    // For OTLP sources there are no Kafka topics; use source.id as the upstream reference
    const isOtlpSource = (internalConfig.source?.type || '').startsWith('otlp.')

    let sinkSourceId: string
    if (hasTransform) {
      const baseName = (internalConfig.name || internalConfig.pipeline_id || 'transform')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-transform$/, '')
      sinkSourceId = `${baseName}-transform`
    } else if (hasJoin) {
      const joinId = (join as { id?: string }).id
      sinkSourceId = joinId ?? topics[0]?.id ?? topics[0]?.name ?? 'source'
    } else {
      sinkSourceId = topics[0]?.id ?? topics[0]?.name ?? (isOtlpSource ? (internalConfig.source?.id ?? 'source') : 'source')
    }

    if (apiConfig.sink) {
      const s = apiConfig.sink
      apiConfig.sink = {
        type: s.type || 'clickhouse',
        connection_params: {
          host: s.host ?? '',
          port: s.port ?? '9000',
          http_port: s.http_port ?? '8123',
          database: s.database ?? 'default',
          username: s.username ?? '',
          password: s.password ?? '',
          secure: s.secure ?? false,
          ...(s.skip_certificate_verification !== undefined && {
            skip_certificate_verification: s.skip_certificate_verification,
          }),
        },
        table: s.table,
        max_batch_size: s.max_batch_size ?? 1000,
        max_delay_time: s.max_delay_time ?? '1s',
        source_id: s.source_id ?? sinkSourceId,
        mapping: (s.table_mapping || []).map((m: any) => ({
          name: m.field_name,
          column_name: m.column_name,
          column_type: m.column_type,
        })),
      }
    }

    // 3. Join: join_key -> key; build join.fields from table_mapping
    if (apiConfig.join?.enabled && Array.isArray(apiConfig.join.sources)) {
      apiConfig.join.sources.forEach((src: any) => {
        if (src.join_key !== undefined) {
          src.key = src.join_key
          delete src.join_key
        }
      })
      const tableMapping = internalConfig.sink?.table_mapping || []
      const joinSourceIds = new Set((apiConfig.join.sources || []).map((s: any) => s.source_id))
      const joinId = apiConfig.join.id
      if (joinId) joinSourceIds.add(joinId)
      const fieldSet = new Set<string>()
      const joinFields: any[] = []
      tableMapping.forEach((m: any) => {
        if (!joinSourceIds.has(m.source_id)) return
        const key = `${m.source_id}:${m.field_name}`
        if (fieldSet.has(key)) return
        fieldSet.add(key)
        joinFields.push({
          source_id: m.source_id,
          name: m.field_name,
          output_name: m.field_name,
        })
      })
      apiConfig.join.fields = joinFields
    }

    // 4. Transformation -> stateless_transformation (same as V2 + source_id)
    if (transformation?.enabled && transformation?.fields?.length) {
      const baseName = (internalConfig.name || internalConfig.pipeline_id || 'transform')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-transform$/, '')
      const transformationId = `${baseName}-transform`
      const transformSourceId = (transformation as { source_id?: string }).source_id ?? topics[0]?.id ?? topics[0]?.name

      apiConfig.stateless_transformation = {
        id: transformationId,
        type: 'expr_lang_transform',
        enabled: true,
        source_id: transformSourceId,
        config: {
          transform: toTransformArray({ enabled: true, fields: transformation.fields }),
        },
      }
      delete apiConfig.transformation
    } else if (transformation && !transformation.enabled) {
      apiConfig.stateless_transformation = {
        id: 'transform',
        type: 'expr_lang_transform',
        enabled: false,
      }
      delete apiConfig.transformation
    }

    apiConfig.version = this.version
    return apiConfig
  }
}
