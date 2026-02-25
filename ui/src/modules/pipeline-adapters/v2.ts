import { PipelineAdapter } from './types'
import { InternalPipelineConfig, Pipeline } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'
import { toTransformArray, exprToFieldName } from '@/src/modules/transformation/utils'

export class V2PipelineAdapter implements PipelineAdapter {
  version = PipelineVersion.V2

  hydrate(apiConfig: any): InternalPipelineConfig {
    // Convert V2 API config (with root-level schema) to Internal (V1-like) structure

    // 1. Deep clone to avoid mutating original
    const internalConfig = JSON.parse(JSON.stringify(apiConfig)) as any

    // 2. Handle stateless_transformation -> transformation conversion
    const statelessTransformation = apiConfig.stateless_transformation

    if (statelessTransformation) {
      if (statelessTransformation.enabled && statelessTransformation.config?.transform) {
        // Convert stateless_transformation back to transformation format
        const transformArray = statelessTransformation.config.transform || []
        const fields = transformArray.map((transform: any, index: number) => {
          const expression = transform.expression || ''
          const outputName = transform.output_name || ''
          const outputType = transform.output_type || 'string'

          // Parse expression: simple identifier or $env["key"] / $env['key'] (for e.g. @timestamp)
          const fieldNameFromExpr = exprToFieldName(expression)
          const isPassthrough = fieldNameFromExpr !== null

          if (isPassthrough) {
            // Passthrough field (bare name or $env["fieldName"])
            return {
              id: `field-${index}`,
              type: 'passthrough',
              outputFieldName: outputName,
              outputFieldType: outputType,
              sourceField: fieldNameFromExpr,
              sourceFieldType: outputType, // Use output type as fallback
            }
          } else {
            // Computed field - try to extract function name and args
            // This is a simplified parser - for complex nested expressions, we store the raw expression
            const functionMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.+)\)$/)
            if (functionMatch) {
              const functionName = functionMatch[1]
              const argsString = functionMatch[2]
              // Parse arguments - this is simplified and may not handle all cases
              // For now, we'll store them as field references or literals based on simple heuristics
              const args: any[] = []
              // Split by comma, but be careful of nested parentheses/arrays
              const argParts = this.parseFunctionArgs(argsString)
              argParts.forEach((arg: string) => {
                const trimmed = arg.trim()
                // Check if it's a string literal
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                  args.push({
                    type: 'literal',
                    value: trimmed.slice(1, -1),
                    literalType: 'string',
                  })
                } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                  // Array literal
                  const arrayContent = trimmed.slice(1, -1)
                  const arrayValues = this.parseFunctionArgs(arrayContent).map((v: string) =>
                    v.trim().replace(/^"|"$/g, ''),
                  )
                  args.push({
                    type: 'array',
                    values: arrayValues,
                    elementType: 'string',
                  })
                } else if (/^-?\d+$/.test(trimmed)) {
                  // Number literal
                  args.push({
                    type: 'literal',
                    value: parseInt(trimmed, 10),
                    literalType: 'number',
                  })
                } else {
                  // Field reference: bare identifier or $env["key"] / $env['key']
                  const fieldName = exprToFieldName(trimmed) ?? trimmed
                  args.push({
                    type: 'field',
                    fieldName: fieldName,
                    fieldType: 'string', // Default type
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
            } else {
              // Complex expression - store as computed with raw expression
              // For complex expressions that can't be parsed (nested calls, ternaries, etc.),
              // we store the raw expression and mark it as complete so validation passes
              return {
                id: `field-${index}`,
                type: 'computed',
                outputFieldName: outputName,
                outputFieldType: outputType,
                functionName: '__raw_expression__', // Special marker for raw expressions
                functionArgs: [
                  {
                    type: 'literal',
                    value: expression,
                    literalType: 'string',
                  },
                ],
                rawExpression: expression, // Store raw expression for complex cases
              }
            }
          }
        })

        internalConfig.transformation = {
          enabled: true,
          expression: '', // Will be regenerated from fields
          fields: fields,
        }
      } else if (!statelessTransformation.enabled) {
        // Transformation exists but is disabled
        internalConfig.transformation = {
          enabled: false,
          expression: '',
          fields: [],
        }
      }

      // Remove stateless_transformation
      delete internalConfig.stateless_transformation
    }

    // 3. Handle Schema hydration (Api V2 -> Internal V1)
    // V2: schema.fields[] contains mapping info + source topic info + types
    // Internal/V1:
    //   - source.topics[].schema (json schema)
    //   - sink.table_mapping (clickhouse mapping)

    const v2Fields = apiConfig.schema?.fields || []

    // Separate fields by source_id:
    // - Fields with source_id = transformation id are transformed fields (already handled above)
    // - Fields with source_id = topic name are source topic fields

    // Identify transformation IDs from stateless_transformation
    const transformationIds = new Set<string>()
    if (statelessTransformation?.enabled && statelessTransformation.id) {
      transformationIds.add(statelessTransformation.id)
    }

    // Reconstruct sink.table_mapping
    // Only include fields that have column_name and column_type (i.e., are mapped to ClickHouse)
    if (v2Fields.length > 0) {
      if (!internalConfig.sink) internalConfig.sink = {}

      internalConfig.sink.table_mapping = v2Fields
        .filter((field: any) => field.column_name && field.column_type)
        .map((field: any) => ({
          source_id: field.source_id,
          field_name: field.name,
          column_name: field.column_name,
          column_type: field.column_type,
        }))
    }

    // Reconstruct source.topics[].schema
    // Only include fields where source_id matches a topic name (not transformation ID)
    const fieldsByTopic: Record<string, any[]> = {}
    v2Fields.forEach((field: any) => {
      // Skip transformed fields (they have transformation ID as source_id)
      if (!transformationIds.has(field.source_id)) {
        const topicId = field.source_id
        if (!fieldsByTopic[topicId]) {
          fieldsByTopic[topicId] = []
        }
        fieldsByTopic[topicId].push(field)
      }
    })

    if (internalConfig.source && Array.isArray(internalConfig.source.topics)) {
      internalConfig.source.topics.forEach((topic: any) => {
        const topicFields = fieldsByTopic[topic.name] || []

        // Rebuild the V1 schema object for this topic
        topic.schema = {
          type: 'json',
          fields: topicFields.map((f: any) => ({
            name: f.name,
            type: f.type,
          })),
        }
      })
    }

    // 4. Internal config expects version to be set
    internalConfig.version = this.version

    // 5. Clean up V2 specific fields that Internal doesn't use
    delete internalConfig.schema

    return internalConfig as InternalPipelineConfig
  }

  /**
   * Helper method to parse function arguments from a string
   * Handles basic cases - may not work for all complex expressions
   */
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

    if (current.trim()) {
      args.push(current.trim())
    }

    return args
  }

  generate(internalConfig: InternalPipelineConfig): any {
    // Convert Internal UI config (V1-like) to V2 API config

    // 1. Deep clone
    const apiConfig = JSON.parse(JSON.stringify(internalConfig)) as any

    // 2. Handle transformation -> stateless_transformation conversion
    const transformation = internalConfig.transformation
    let transformationId: string | null = null

    if (transformation?.enabled && transformation?.fields && transformation.fields.length > 0) {
      // Generate transformation ID from pipeline name or ID
      // Pattern: remove "-transform" suffix if present, then add "-transform"
      // This ensures consistent naming (e.g., "taggrs-complete-transform-5" -> "taggrs-complete-transform-5-transform")
      // But we want just the base name: "taggrs" -> "taggrs-transform"
      // For now, use pipeline_id or name, removing any existing "-transform" suffix
      const baseName = internalConfig.name || internalConfig.pipeline_id || 'transform'
      const cleanName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-transform$/, '')
      transformationId = `${cleanName}-transform`

      // Convert transformation fields to stateless_transformation format (same as evaluate API)
      const transformArray = toTransformArray({
        enabled: true,
        fields: transformation.fields,
      })

      apiConfig.stateless_transformation = {
        id: transformationId,
        type: 'expr_lang_transform',
        enabled: true,
        config: {
          transform: transformArray,
        },
      }

      // Remove old transformation field
      delete apiConfig.transformation
    } else if (transformation && !transformation.enabled) {
      // Transformation exists but is disabled
      apiConfig.stateless_transformation = {
        id: 'transform',
        type: 'expr_lang_transform',
        enabled: false,
      }
      delete apiConfig.transformation
    }

    // 3. Extract mappings and schemas to build root "schema"
    // When transformation is enabled: effective schema = transform outputs only (+ topic fields only when
    // dedup/filter/join require the ingestor to validate the topic).
    // When transformation is disabled: schema = topic schema with mapping.

    const v2Fields: any[] = []
    const tableMapping = internalConfig.sink?.table_mapping || []
    const topics = internalConfig.source?.topics || []

    const hasTransform =
      Boolean(transformationId && transformation?.enabled && transformation?.fields?.length) ?? false

    if (hasTransform) {
      // Effective schema: one schema field per mapping row so one source field can map to multiple columns.
      // Preserve transformation field order: for each transform field, emit all its mapping rows, then unmapped.
      const getType = (fieldName: string) => {
        const f = transformation!.fields!.find((x: any) => x.outputFieldName === fieldName)
        return f?.outputFieldType || 'string'
      }
      const topicNames = new Set((topics || []).map((t: any) => t.name))
      const isTransformMapping = (m: any) =>
        (m.source_id === transformationId || topicNames.has(m.source_id)) &&
        m.column_name &&
        m.column_type
      const transformMappings = tableMapping.filter(isTransformMapping)
      transformation!.fields!.forEach((field: any) => {
        const mappingsForField = transformMappings.filter(
          (m: any) => m.field_name === field.outputFieldName,
        )
        if (mappingsForField.length > 0) {
          mappingsForField.forEach((mapping: any) => {
            v2Fields.push({
              source_id: transformationId!,
              name: mapping.field_name,
              type: getType(mapping.field_name),
              column_name: mapping.column_name,
              column_type: mapping.column_type,
            })
          })
        } else {
          v2Fields.push({
            source_id: transformationId!,
            name: field.outputFieldName,
            type: field.outputFieldType || 'string',
          })
        }
      })
      // Include any table_mapping row for transform that wasn't in transformation.fields (e.g. legacy)
      transformMappings.forEach((mapping: any) => {
        if (
          v2Fields.some(
            (f: any) =>
              f.source_id === transformationId &&
              f.name === mapping.field_name &&
              f.column_name === mapping.column_name,
          )
        )
          return
        v2Fields.push({
          source_id: transformationId!,
          name: mapping.field_name,
          type: getType(mapping.field_name),
          column_name: mapping.column_name,
          column_type: mapping.column_type,
        })
      })

      // When dedup/filter/join need topic in schema, add minimal topic fields so the ingestor can validate
      const needsTopicInSchema =
        topics.some((t: any) => t.deduplication?.enabled && t.deduplication?.id_field) ||
        Boolean(internalConfig.filter?.enabled) ||
        (internalConfig.join?.enabled &&
          Array.isArray(internalConfig.join?.sources) &&
          internalConfig.join.sources.length > 0)

      if (needsTopicInSchema) {
        // Dedup keys: at least the id_field per topic that has dedup enabled
        topics.forEach((topic: any) => {
          if (!topic.deduplication?.enabled || !topic.deduplication?.id_field) return
          const keyName = topic.deduplication.id_field
          const topicField = topic.schema?.fields?.find((f: any) => f.name === keyName && !f.isRemoved)
          const mapping = tableMapping.find((m: any) => m.source_id === topic.name && m.field_name === keyName)
          v2Fields.push({
            source_id: topic.name,
            name: keyName,
            type: topicField?.type ?? 'string',
            ...(mapping ? { column_name: mapping.column_name, column_type: mapping.column_type } : {}),
          })
        })
        // Join keys: each join source's join_key
        if (internalConfig.join?.enabled && Array.isArray(internalConfig.join?.sources)) {
          internalConfig.join.sources.forEach((js: any) => {
            if (!js.join_key) return
            const topic = topics.find((t: any) => t.name === js.source_id)
            const topicField = topic?.schema?.fields?.find(
              (f: any) => f.name === js.join_key && !f.isRemoved,
            )
            const mapping = tableMapping.find(
              (m: any) => m.source_id === js.source_id && m.field_name === js.join_key,
            )
            if (!v2Fields.some((f: any) => f.source_id === js.source_id && f.name === js.join_key)) {
              v2Fields.push({
                source_id: js.source_id,
                name: js.join_key,
                type: topicField?.type ?? 'string',
                ...(mapping ? { column_name: mapping.column_name, column_type: mapping.column_type } : {}),
              })
            }
          })
        }
        // Filter: include topic fields so ingestor can validate the filter expression.
        // Skip fields that are already in v2Fields (e.g. as transform outputs) to avoid duplicate schema entries.
        if (internalConfig.filter?.enabled) {
          topics.forEach((topic: any) => {
            const topicFields = (topic.schema?.fields || []).filter((f: any) => !f.isRemoved)
            topicFields.forEach((field: any) => {
              const alreadyEmitted =
                v2Fields.some((f: any) => f.source_id === topic.name && f.name === field.name) ||
                v2Fields.some((f: any) => f.name === field.name)
              if (!alreadyEmitted) {
                const mapping = tableMapping.find(
                  (m: any) => m.source_id === topic.name && m.field_name === field.name,
                )
                v2Fields.push({
                  source_id: topic.name,
                  name: field.name,
                  type: field.type || 'string',
                  ...(mapping ? { column_name: mapping.column_name, column_type: mapping.column_type } : {}),
                })
              }
            })
          })
        }
      }
    } else {
      // No transformation: schema = topic schema with mapping
      const mappedFieldNamesByTopic: Record<string, Set<string>> = {}
      tableMapping.forEach((mapping: any) => {
        const topic = topics.find((t: any) => t.name === mapping.source_id)
        if (topic) {
          if (!mappedFieldNamesByTopic[mapping.source_id]) {
            mappedFieldNamesByTopic[mapping.source_id] = new Set()
          }
          mappedFieldNamesByTopic[mapping.source_id].add(mapping.field_name)
        }
      })
      topics.forEach((topic: any) => {
        const topicFields = (topic.schema?.fields || []).filter((f: any) => !f.isRemoved)
        topicFields.forEach((field: any) => {
          const isMapped = mappedFieldNamesByTopic[topic.name]?.has(field.name)
          const mapping = tableMapping.find(
            (m: any) => m.source_id === topic.name && m.field_name === field.name,
          )
          v2Fields.push({
            source_id: topic.name,
            name: field.name,
            type: field.type || 'string',
            ...(isMapped && mapping
              ? { column_name: mapping.column_name, column_type: mapping.column_type }
              : {}),
          })
        })
      })
      tableMapping.forEach((mapping: any) => {
        if (v2Fields.some((f: any) => f.source_id === mapping.source_id && f.name === mapping.field_name))
          return
        const topic = topics.find((t: any) => t.name === mapping.source_id)
        const topicField = topic?.schema?.fields?.find(
          (f: any) => f.name === mapping.field_name && !f.isRemoved,
        )
        v2Fields.push({
          source_id: mapping.source_id,
          name: mapping.field_name,
          type: topicField?.type || 'string',
          column_name: mapping.column_name,
          column_type: mapping.column_type,
        })
      })
    }

    // 4. Construct V2 Root Schema
    apiConfig.schema = {
      fields: v2Fields,
    }

    // 5. Remove Internal/V1 fields that don't exist in V2
    if (apiConfig.sink) {
      delete apiConfig.sink.table_mapping
    }

    if (apiConfig.source && Array.isArray(apiConfig.source.topics)) {
      apiConfig.source.topics.forEach((topic: any) => {
        delete topic.schema
      })
    }

    // 6. Set version
    apiConfig.version = this.version

    return apiConfig
  }
}
