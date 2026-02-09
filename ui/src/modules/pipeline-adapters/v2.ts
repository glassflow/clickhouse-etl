import { PipelineAdapter } from './types'
import { InternalPipelineConfig, Pipeline } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'
import { fieldToExpr } from '@/src/modules/transformation/utils'
import { TransformationField } from '@/src/store/transformation.store'

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

          // Try to parse expression to determine if passthrough or computed
          // Simple heuristic: if expression is just a field name (no parentheses, no function calls), it's passthrough
          const isPassthrough = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.trim())

          if (isPassthrough) {
            // Passthrough field
            return {
              id: `field-${index}`,
              type: 'passthrough',
              outputFieldName: outputName,
              outputFieldType: outputType,
              sourceField: expression.trim(),
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
                  // Assume it's a field reference
                  args.push({
                    type: 'field',
                    fieldName: trimmed,
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

      // Convert transformation fields to stateless_transformation format
      const transformArray = transformation.fields.map((field: any) => {
        // Create a TransformationField-like object for fieldToExpr (must include all props used by fieldToExpr)
        const fieldObj: TransformationField = {
          id: field.id || '',
          type: field.type || 'passthrough',
          outputFieldName: field.outputFieldName || '',
          outputFieldType: field.outputFieldType || 'string',
          ...(field.expressionMode !== undefined && { expressionMode: field.expressionMode }),
          ...(field.rawExpression !== undefined && { rawExpression: field.rawExpression }),
          ...(field.arithmeticExpression !== undefined && { arithmeticExpression: field.arithmeticExpression }),
          ...(field.type === 'passthrough'
            ? {
                sourceField: field.sourceField || '',
                sourceFieldType: field.sourceFieldType || 'string',
              }
            : {
                functionName: field.functionName || '',
                functionArgs: field.functionArgs || [],
              }),
        }

        const expression = fieldToExpr(fieldObj)

        return {
          expression,
          output_name: field.outputFieldName,
          output_type: field.outputFieldType,
        }
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
    // Internal: sink.table_mapping + source.topics[].schema
    // V2: root schema.fields
    // Schema should include:
    // - Transformed fields (if transformation exists) with source_id = transformation id
    // - Source topic fields with source_id = topic name
    // - Only mapped fields should have column_name and column_type

    const v2Fields: any[] = []

    const tableMapping = internalConfig.sink?.table_mapping || []
    const topics = internalConfig.source?.topics || []

    // First, add transformed fields to schema (if transformation exists)
    if (transformationId && transformation?.enabled && transformation?.fields) {
      transformation.fields.forEach((field: any) => {
        // Find if this field is mapped to a ClickHouse column
        const mapping = tableMapping.find(
          (m: any) => m.source_id === transformationId && m.field_name === field.outputFieldName,
        )

        v2Fields.push({
          source_id: transformationId,
          name: field.outputFieldName,
          type: field.outputFieldType || 'string',
          ...(mapping
            ? {
                column_name: mapping.column_name,
                column_type: mapping.column_type,
              }
            : {}),
        })
      })
    }

    // Then, add source topic fields to schema
    // Group table mappings by source_id (topic name) to identify which fields are mapped
    const mappedFieldNamesByTopic: Record<string, Set<string>> = {}
    tableMapping.forEach((mapping: any) => {
      // Only include mappings that reference topic names (not transformation IDs)
      const topic = topics.find((t: any) => t.name === mapping.source_id)
      if (topic) {
        if (!mappedFieldNamesByTopic[mapping.source_id]) {
          mappedFieldNamesByTopic[mapping.source_id] = new Set()
        }
        mappedFieldNamesByTopic[mapping.source_id].add(mapping.field_name)
      }
    })

    // Add all source topic fields to schema (excluding removed fields)
    topics.forEach((topic: any) => {
      const topicFields = (topic.schema?.fields || []).filter((f: any) => !f.isRemoved)
      const mappedFields = mappedFieldNamesByTopic[topic.name] || new Set()

      topicFields.forEach((field: any) => {
        const isMapped = mappedFields.has(field.name)
        const mapping = tableMapping.find((m: any) => m.source_id === topic.name && m.field_name === field.name)

        v2Fields.push({
          source_id: topic.name,
          name: field.name,
          type: field.type || 'string',
          ...(isMapped && mapping
            ? {
                column_name: mapping.column_name,
                column_type: mapping.column_type,
              }
            : {}),
        })
      })
    })

    // Also include any table mappings that reference transformation but aren't in transformed fields
    // (This handles edge cases where mappings exist but transformation fields don't)
    tableMapping.forEach((mapping: any) => {
      // Skip if already added (either as transformed field or topic field)
      const alreadyAdded = v2Fields.some((f: any) => f.source_id === mapping.source_id && f.name === mapping.field_name)

      if (!alreadyAdded) {
        // This is a mapping that doesn't correspond to a known field
        // Try to find type from topic schema (excluding removed fields)
        const topic = topics.find((t: any) => t.name === mapping.source_id)
        const topicField = topic?.schema?.fields?.find((f: any) => f.name === mapping.field_name && !f.isRemoved)

        v2Fields.push({
          source_id: mapping.source_id,
          name: mapping.field_name,
          type: topicField?.type || 'string',
          column_name: mapping.column_name,
          column_type: mapping.column_type,
        })
      }
    })

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
