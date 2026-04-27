import { v4 as uuidv4 } from 'uuid'
import { KafkaConnectionParams, TableColumn } from './types'
import { extractEventFields, getRuntimeEnv } from '@/src/utils/common.client'
import { structuredLogger } from '@/src/observability'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import { LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'
import { normalizeFieldType, valueToFieldType, jsonTypeToClickHouseType } from '@/src/utils/type-conversion'
import { getSourceAdapter } from '@/src/adapters/source'

/**
 * Recursively extracts all field names used in a filter tree
 * Handles both simple field references and arithmetic expressions
 */
const extractFilterFields = (node: any): string[] => {
  const fields: string[] = []

  if (!node) return fields

  if (node.type === 'rule') {
    // Simple field reference
    if (node.field) {
      fields.push(node.field)
    }

    // Arithmetic expression fields
    if (node.useArithmeticExpression && node.arithmeticExpression) {
      fields.push(...extractArithmeticFields(node.arithmeticExpression))
    }
  } else if (node.type === 'group' && Array.isArray(node.children)) {
    // Recursively process group children
    node.children.forEach((child: any) => {
      fields.push(...extractFilterFields(child))
    })
  }

  return fields
}

/**
 * Extracts field names from an arithmetic expression node
 */
const extractArithmeticFields = (node: any): string[] => {
  const fields: string[] = []

  if (!node) return fields

  // Check if it's a field operand
  if (node.type === 'field' && node.field) {
    fields.push(node.field)
  }

  // Recursively process left and right operands
  if (node.left) {
    fields.push(...extractArithmeticFields(node.left))
  }
  if (node.right) {
    fields.push(...extractArithmeticFields(node.right))
  }

  return fields
}

/**
 * Check if a column is ALIAS or MATERIALIZED (should be hidden from UI)
 */
export const shouldExcludeColumn = (column: TableColumn): boolean => {
  const defaultType = column.default_type || column.default_kind || ''
  return defaultType === 'ALIAS' || defaultType === 'MATERIALIZED'
}

/**
 * Check if a column has a DEFAULT expression
 */
export const hasDefaultExpression = (column: TableColumn): boolean => {
  const defaultType = column.default_type || column.default_kind || ''
  return !!(column.default_expression || defaultType === 'DEFAULT')
}

/**
 * Filter out ALIAS and MATERIALIZED columns from schema
 */
export const filterUserMappableColumns = (columns: TableColumn[]): TableColumn[] => {
  return columns.filter((col) => !shouldExcludeColumn(col))
}

// Build Internal Pipeline Config from UI stores
export const buildInternalPipelineConfig = ({
  pipelineId,
  pipelineName,
  setPipelineId,
  clickhouseConnection,
  clickhouseDestination,
  selectedTopics,
  getMappingType,
  joinStore,
  kafkaStore,
  deduplicationStore,
  filterStore,
  transformationStore,
  coreStore,
  otlpStore,
}: {
  pipelineId: string
  pipelineName: string
  setPipelineId: (pipelineId: string) => void
  clickhouseConnection: any
  clickhouseDestination: any
  selectedTopics: any
  getMappingType: (eventField: string, mapping: any) => string
  joinStore: any
  kafkaStore: any
  deduplicationStore: any
  filterStore?: any
  transformationStore?: any
  coreStore?: any
  otlpStore?: any
}): InternalPipelineConfig => {
  // Generate a new pipeline ID if one doesn't exist
  let finalPipelineId = pipelineId
  if (!finalPipelineId) {
    finalPipelineId = uuidv4()
    setPipelineId(finalPipelineId)
  }

  // Resolve source adapter — single branch point for Kafka vs OTLP differences
  const sourceAdapter = getSourceAdapter(coreStore?.sourceType)
  const wireSource = sourceAdapter.toWireSource({
    kafkaStore,
    topicsStore: { selectedTopics },
    deduplicationStore,
    coreStore,
    otlpStore,
  })
  const isOtlp = !wireSource.supportsJoin && wireSource.supportsSingleTopicFeatures && sourceAdapter.type !== 'kafka'

  const mapping = clickhouseDestination?.mapping || []

  // Map topics to the expected format
  const topicsConfig = selectedTopics.map((topic: any, topicIndex: number) => {
    // Extract event data, ensuring _metadata is removed
    let eventData = {}
    if (topic.events && topic.selectedEvent && topic.selectedEvent.event) {
      // Get the actual event data (either directly or from .event property)
      const rawEvent = topic?.selectedEvent?.event || {}

      // Clone the event and remove _metadata
      eventData = { ...rawEvent }
      if (typeof eventData === 'object' && eventData !== null && '_metadata' in eventData) {
        delete (eventData as any)._metadata
      }
    }

    // Get deduplication config from the new separated store
    const deduplicationConfig = deduplicationStore?.getDeduplication?.(topicIndex) || null

    // Prefer topic.schema.fields (from Kafka Type Verification) when present, so user type overrides persist
    const schemaFields =
      topic.schema?.fields?.length > 0
        ? topic.schema.fields
            .filter((f: any) => !f.isRemoved)
            .map((f: any) => ({
              name: f.name,
              type: f.userType || f.type || 'string',
            }))
        : extractEventFields(eventData).map((fieldPath) => {
            const mappingType = getMappingType(fieldPath, mapping)
            const inferredType = getFieldType(eventData, fieldPath)
            return {
              name: fieldPath,
              type: mappingType || inferredType,
            }
          })

    return {
      consumer_group_initial_offset: topic.initialOffset,
      name: topic.name,
      id: topic.name, // Using topic name as id for now
      replicas: topic.replicas,
      schema: {
        type: 'json',
        fields: schemaFields,
      },
      deduplication:
        // Enable deduplication if:
        // 1. Deduplication is properly configured (enabled and has a key), AND
        // 2. Either we're NOT in a join journey, OR we're in a deduplication-joining journey
        deduplicationConfig && deduplicationConfig.enabled && deduplicationConfig.key
          ? {
              enabled: true,
              id_field: deduplicationConfig.key,
              id_field_type: deduplicationConfig.keyType,
              time_window: deduplicationConfig.window
                ? `${deduplicationConfig.window}${deduplicationConfig.unit?.charAt(0) || 'h'}`
                : '1h',
            }
          : {
              enabled: false,
            },
    }
  })

  // Create mapping for ClickHouse table
  const tableMappings = clickhouseDestination?.mapping
    ? clickhouseDestination.mapping
        .filter((mapping: any) => mapping.eventField) // Only include mapped fields
        .filter((mapping: any) => !mapping.eventField.startsWith('_metadata')) // Exclude _metadata fields
        .map((mapping: any) => {
          // Get source topic from mapping if available
          let sourceId = mapping.sourceTopic || selectedTopics[0]?.name

          // If no sourceTopic is specified in the mapping, we need to find it
          if (!mapping.sourceTopic) {
            // Try to find which topic contains this field
            for (const topic of selectedTopics) {
              if (topic.events && topic.selectedEvent && topic.selectedEvent.event) {
                const eventData = topic?.selectedEvent?.event || {}

                // Check if the field exists in this topic's event data
                if (mapping.eventField in eventData) {
                  sourceId = topic.name
                  break
                }
              }
            }
          }

          // Now check if the field is in a stream in joinStore
          if (joinStore.streams && joinStore.streams.length > 0) {
            // Try to find the stream that has this field as its join key
            for (const stream of joinStore.streams) {
              if (stream.joinKey === mapping.eventField) {
                sourceId = stream.topicName || stream.streamId
                break
              }
            }
          }

          // If the mapped field is a transformation output (passthrough or computed), use the current
          // transformation ID as source_id so the column is attributed to the transform in the pipeline
          // schema. This ensures that when generating V2 config (e.g. after upload), table_mapping rows
          // match the adapter's transformationId and schema.fields get column_name/column_type.
          if (transformationStore?.transformationConfig?.enabled && transformationStore.transformationConfig?.fields?.length > 0) {
            const transformOutputField = transformationStore.transformationConfig.fields.find(
              (f: any) => f.outputFieldName === mapping.eventField,
            )
            if (transformOutputField) {
              const baseName = (pipelineName || 'transform').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-transform$/, '')
              sourceId = `${baseName}-transform`
            }
          }

          // For OTLP: no Kafka topics so selectedTopics[0] is undefined; fall back to the OTLP source id
          if (isOtlp && !sourceId) {
            sourceId = otlpStore?.sourceId || 'source'
          }

          return {
            source_id: sourceId,
            field_name: mapping.eventField,
            column_name: mapping.name,
            column_type: mapping.type.replace(/Nullable\((.*)\)/, '$1'), // Remove Nullable wrapper
          }
        })
    : []

  // Normalize Kafka broker hosts when running inside Docker.
  // Applied post-adapter to keep the adapter free of environment concerns.
  const runtimeEnv = getRuntimeEnv()
  const inDocker = runtimeEnv?.NEXT_PUBLIC_IN_DOCKER === 'true' || process.env.NEXT_PUBLIC_IN_DOCKER === 'true'

  const normalizeBroker = (broker: string): string => {
    if (!broker) return broker
    const [host, port] = broker.split(':')
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
    if (inDocker && isLocal) {
      return `host.docker.internal${port ? `:${port}` : ''}`
    }
    return broker
  }

  // Apply Docker broker normalization to Kafka connection params if present
  const finalSource = (() => {
    const src = wireSource.source as any
    if (src?.connection_params?.brokers && Array.isArray(src.connection_params.brokers)) {
      return {
        ...src,
        connection_params: {
          ...src.connection_params,
          brokers: src.connection_params.brokers.map((b: string) => normalizeBroker(b)),
        },
      }
    }
    return src
  })()

  const config: InternalPipelineConfig = {
    pipeline_id: finalPipelineId,
    name: pipelineName,
    source: finalSource,
    // Include join configuration for Kafka multi-topic pipelines; disabled join for all others
    join: !wireSource.supportsJoin
      ? { enabled: false }
      : {
          enabled: joinStore.enabled,
          type: joinStore.type || 'temporal',
          sources:
            joinStore.streams.length > 0
              ? joinStore.streams.map((stream: any) => ({
                  source_id: stream.topicName,
                  join_key: stream.joinKey,
                  time_window: `${stream.joinTimeWindowValue}${stream.joinTimeWindowUnit.charAt(0)}`,
                  orientation: stream.orientation,
                }))
              : topicsConfig.map((topic: any, index: number) => {
                  const deduplicationConfig = deduplicationStore?.getDeduplication?.(index) || null
                  const joinKey = deduplicationConfig?.key || ''
                  return {
                    source_id: topic.name,
                    join_key: joinKey,
                    time_window: '1h',
                    orientation: index === 0 ? 'left' : 'right',
                  }
                }),
        },
    sink: {
      type: 'clickhouse',
      provider: 'custom', // Or determine from connection details
      ...(clickhouseConnection?.connectionType === 'direct'
        ? {
            host: clickhouseConnection.directConnection?.host,
            // Backend expects native port on sink.port
            port: clickhouseConnection.directConnection?.nativePort?.toString() || '9000',
            // Provide http_port so backend echoes it back for UI editing
            http_port: clickhouseConnection.directConnection?.httpPort?.toString() || undefined,
            database: clickhouseDestination?.database,
            username: clickhouseConnection.directConnection?.username,
            password: clickhouseConnection.directConnection?.password,
            secure: clickhouseConnection.directConnection?.useSSL || false,
            skip_certificate_verification: clickhouseConnection.directConnection?.skipCertificateVerification || false,
            max_batch_size: clickhouseDestination?.maxBatchSize || 1000,
            max_delay_time: (() => {
              const time = clickhouseDestination?.maxDelayTime || 1
              const unit = clickhouseDestination?.maxDelayTimeUnit || 'm'

              // Convert full unit names to single letters if needed
              let singleLetterUnit = unit
              if (unit === 'seconds') singleLetterUnit = 's'
              else if (unit === 'minutes') singleLetterUnit = 'm'
              else if (unit === 'hours') singleLetterUnit = 'h'
              else if (unit === 'days') singleLetterUnit = 'd'

              return `${time}${singleLetterUnit}`
            })(),
          }
        : {}),
      // Ensure missing required fields are handled or typed as optional in InternalPipelineConfig if needed
      // but assuming they are filled by the spread above or default values
      table: clickhouseDestination?.table,
      table_mapping: tableMappings,
      ...(clickhouseDestination?.engine ? { engine: clickhouseDestination.engine } : {}),
      ...(clickhouseDestination?.orderBy
        ? {
            order_by: (() => {
              const mapping = clickhouseDestination?.mapping ?? []
              const byEventField = mapping.find(
                (m: any) => m.eventField === clickhouseDestination.orderBy,
              )
              const byColumnName = mapping.find((m: any) => m.name === clickhouseDestination.orderBy)
              return byEventField?.name ?? byColumnName?.name ?? clickhouseDestination.orderBy
            })(),
          }
        : {}),
    } as any, // Type assertion to bypass strict checks on conditional properties for now
    // Include filter configuration for single-topic and OTLP pipelines
    // Filter is not available for multi-topic (join) journeys
    ...(wireSource.supportsSingleTopicFeatures
      ? filterStore?.filterConfig?.enabled && filterStore?.expressionString
        ? {
            filter: {
              enabled: true,
              expression: `!(${filterStore.expressionString})`,
            },
          }
        : {
            filter: {
              enabled: false,
              expression: '',
            },
          }
      : {}),
    // Include transformation configuration for single-topic and OTLP pipelines
    // Transformation is not available for multi-topic (join) journeys
    ...(wireSource.supportsSingleTopicFeatures
      ? transformationStore?.transformationConfig?.enabled &&
        transformationStore?.transformationConfig?.fields?.length > 0
        ? {
            transformation: {
              enabled: true,
              expression: transformationStore.expressionString || '',
              fields: transformationStore.transformationConfig.fields.map((field: any) => ({
                id: field.id,
                type: field.type,
                outputFieldName: field.outputFieldName,
                outputFieldType: field.outputFieldType,
                ...(field.expressionMode !== undefined && { expressionMode: field.expressionMode }),
                ...(field.rawExpression !== undefined && { rawExpression: field.rawExpression }),
                ...(field.arithmeticExpression !== undefined && {
                  arithmeticExpression: field.arithmeticExpression,
                }),
                ...(field.type === 'passthrough'
                  ? {
                      sourceField: field.sourceField,
                      sourceFieldType: field.sourceFieldType,
                    }
                  : {
                      functionName: field.functionName,
                      functionArgs: field.functionArgs,
                    }),
              })),
            },
          }
        : {
            transformation: {
              enabled: false,
              expression: '',
              fields: [],
            },
          }
      : {}),
  }

  return config
}

// Generate API config using version adapters
export const generateApiConfig = ({
  pipelineId,
  pipelineName,
  setPipelineId,
  clickhouseConnection,
  clickhouseDestination,
  selectedTopics,
  getMappingType,
  joinStore,
  kafkaStore,
  deduplicationStore,
  filterStore,
  transformationStore,
  pipeline_resources,
  version: _version, // ignored — generation always uses LATEST_PIPELINE_VERSION
  coreStore,
  otlpStore,
}: {
  pipelineId: string
  pipelineName: string
  setPipelineId: (pipelineId: string) => void
  clickhouseConnection: any
  clickhouseDestination: any
  selectedTopics: any
  getMappingType: (eventField: string, mapping: any) => string
  joinStore: any
  kafkaStore: any
  deduplicationStore: any
  filterStore?: any
  transformationStore?: any
  pipeline_resources?: import('@/src/types/pipeline').PipelineResources | null
  version?: string
  coreStore?: any
  otlpStore?: any
}) => {
  try {
    // 1. Build the internal configuration structure
    const internalConfig = buildInternalPipelineConfig({
      pipelineId,
      pipelineName,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
      deduplicationStore,
      filterStore,
      transformationStore,
      coreStore,
      otlpStore,
    })

    // 2. Always generate in the latest format — the internal config shape is version-agnostic
    //    so any adapter can hydrate into it, but generation always targets the current backend API.
    const adapter = getPipelineAdapter(LATEST_PIPELINE_VERSION)

    // 3. Enrich internalConfig with pipeline_resources so the V3 adapter can translate
    // them into resources.sources[] / resources.transform[] in the output.
    // For legacy adapters (V1/V2) that don't handle this translation, we fall back to
    // merging pipeline_resources as a top-level key after generation.
    const enrichedConfig =
      pipeline_resources && typeof pipeline_resources === 'object' && Object.keys(pipeline_resources).length > 0
        ? { ...internalConfig, pipeline_resources }
        : internalConfig

    // 4. Generate the external API configuration
    const apiConfig = adapter.generate(enrichedConfig)

    // 5. Legacy fallback: V1/V2 adapters don't translate pipeline_resources internally
    if (
      pipeline_resources &&
      Object.keys(pipeline_resources).length > 0 &&
      adapter.version !== 'v3'
    ) {
      return { ...apiConfig, pipeline_resources }
    }
    return apiConfig
  } catch (error) {
    structuredLogger.error('Error generating API config', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to generate API configuration' }
  }
}

// Helper function to find best matching field
export const findBestMatchingField = (columnName: string, fields: string[]): string | undefined => {
  // Normalize by removing underscores, dots, and lowercasing
  const normalize = (str: string) => str.toLowerCase().replace(/[_\.]/g, '')
  const normalizedColumnName = normalize(columnName)

  // Try to match the full path structure
  const pathMatch = fields.find((field) => normalize(field) === normalizedColumnName)
  if (pathMatch) return pathMatch

  // Try to match by last part (for flat fields)
  const lastPartMatch = fields.find((field) => {
    const lastPart = field.split('.').pop() || ''
    return normalize(lastPart) === normalizedColumnName
  })
  if (lastPartMatch) return lastPartMatch

  // Then try contains match
  const containsMatch = fields.find((field) => {
    const lastPart = field.split('.').pop() || ''
    return normalize(lastPart).includes(normalizedColumnName) || normalizedColumnName.includes(normalize(lastPart))
  })
  return containsMatch
}

// Helper function to get nested value from an object using dot notation
export const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined

  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    if (typeof current === 'object' && current !== null) {
      current = (current as any)[part]
    } else {
      return undefined
    }
  }

  return current
}

// Helper function to get the type for a specific field path
export const getFieldType = (data: any, fieldPath: string): string => {
  const value = getNestedValue(data, fieldPath)
  if (value === undefined || value === null) {
    return 'string' // Default type for undefined/null values
  }
  return valueToFieldType(value)
}

/**
 * Get verified type for a field from the topic's schema (schema.fields).
 * Used when we have topic schema and want to use the schema type rather than inferring from data.
 */
export const getVerifiedTypeFromTopic = (topic: any, fieldName: string): string | undefined => {
  if (!topic?.schema?.fields || !Array.isArray(topic.schema.fields)) {
    return undefined
  }
  const schemaField = topic.schema.fields.find((f: any) => f.name === fieldName && !f.isRemoved)
  return schemaField?.userType || schemaField?.type
}

/**
 * Maps JSON/Kafka types to compatible ClickHouse types
 * Simplified to use basic types: string, bool, int, float, bytes, array
 */
export const TYPE_COMPATIBILITY_MAP: Record<string, string[]> = {
  // Primary simplified types
  string: [
    'String',
    'FixedString',
    'DateTime',
    'DateTime64',
    'UUID',
    'Enum8',
    'Enum16',
    'Decimal',
    'Bool',
    'UInt8',
    'UInt16',
    'UInt32',
    'UInt64',
    'UInt128',
    'Date',
    'Date32',
  ],
  bool: ['Bool'],
  int: ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'DateTime', 'DateTime64'],
  float: ['Float32', 'Float64', 'Decimal', 'DateTime', 'DateTime64'],
  bytes: ['String'],
  array: ['Array', 'String'],
  // map type: primary target is Map(String, String) for create-table path;
  // String is allowed as a fallback for JSON-serialised storage
  map: ['Map(String, String)', 'String'],

  // Backward compatibility: legacy precision types map to same ClickHouse types
  int8: ['Int8', 'Int16', 'Int32', 'Int64'],
  int16: ['Int16', 'Int32', 'Int64'],
  int32: ['Int32', 'Int64'],
  int64: ['Int64', 'DateTime', 'DateTime64'],
  uint: ['UInt8', 'UInt16', 'UInt32', 'UInt64'],
  uint8: ['UInt8', 'UInt16', 'UInt32', 'UInt64'],
  uint16: ['UInt16', 'UInt32', 'UInt64'],
  uint32: ['UInt32', 'UInt64'],
  uint64: ['UInt64'],
  float32: ['Float32', 'Float64'],
  float64: ['Float64'],

  // JavaScript types for edge cases
  number: ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64', 'Decimal'],
  boolean: ['Bool'],
  object: ['String'],
  null: ['Nullable'],
  undefined: ['Nullable'],
}

/**
 * Checks if a source type (Kafka/JSON) is compatible with a ClickHouse column type
 * @param sourceType The source data type (Kafka/JSON)
 * @param clickhouseType The ClickHouse column type (can be undefined if column type is not available)
 * @returns boolean indicating if the types are compatible
 */
export function isTypeCompatible(sourceType: string | undefined, clickhouseType: string | undefined): boolean {
  // If no source type provided, we consider it incompatible
  if (!sourceType) return false

  // If no clickhouse type provided, we consider it incompatible
  if (!clickhouseType) return false

  // Handle Nullable types in ClickHouse
  if (clickhouseType.startsWith('Nullable(')) {
    const innerType = clickhouseType.substring(9, clickhouseType.length - 1)
    return isTypeCompatible(sourceType, innerType)
  }

  // Handle Array types in ClickHouse
  if (clickhouseType.startsWith('Array(')) {
    const innerType = clickhouseType.substring(6, clickhouseType.length - 1)
    return sourceType === 'array' || isTypeCompatible(sourceType, innerType)
  }

  // Handle Map types in ClickHouse (e.g. Map(String, String), Map(LowCardinality(String), String))
  // Must be handled explicitly: the generic substring check below would wrongly match 'String'
  // inside a Map type's parameter list against non-map source types.
  if (clickhouseType.startsWith('Map(')) {
    return sourceType === 'map'
  }

  // Handle LowCardinality wrapper — strip it and recurse so LowCardinality(String) matches 'string'
  if (clickhouseType.startsWith('LowCardinality(')) {
    const innerType = clickhouseType.substring(15, clickhouseType.length - 1)
    return isTypeCompatible(sourceType, innerType)
  }

  // Check the compatibility map
  const compatibleTypes = TYPE_COMPATIBILITY_MAP[sourceType.toLowerCase()]
  if (!compatibleTypes) return false

  // Check if any compatible type matches (partially) the ClickHouse type
  return compatibleTypes.some((type) => clickhouseType.includes(type))
}

/**
 * Validates column mappings for compatibility between source and destination types
 * @param mappings Array of column mappings to validate
 * @returns An object containing valid and invalid mappings
 */
export function validateColumnMappings(mappings: any[]) {
  const validMappings: any[] = []
  const invalidMappings: any[] = []
  const missingTypeMappings: any[] = []

  mappings.forEach((mapping) => {
    // Skip columns that aren't mapped
    if (!mapping.eventField) return

    // Check for missing jsonType
    if (!mapping.jsonType) {
      missingTypeMappings.push({
        ...mapping,
        reason: `Missing type: Field ${mapping.eventField} is mapped to column ${mapping.name} but has no inferred type`,
      })
      return
    }

    const isValid = isTypeCompatible(mapping.jsonType, mapping.type)
    if (isValid) {
      validMappings.push(mapping)
    } else {
      invalidMappings.push({
        ...mapping,
        reason: `Incompatible type: ${mapping.jsonType} cannot be mapped to ${mapping.type}`,
      })
    }
  })

  return {
    validMappings,
    invalidMappings,
    missingTypeMappings,
  }
}

export const getMappingType = (eventField: string, mapping: any) => {
  const mappingEntry = mapping.find((m: any) => m.eventField === eventField)

  if (mappingEntry) {
    return mappingEntry.jsonType
  }

  // NOTE: default to string if no mapping entry is found - check this
  return 'string'
}

export interface AlterTableAddOperation {
  op: 'add'
  name: string
  type: string
  nullable?: boolean
}

/**
 * Compute ALTER TABLE operations for new columns.
 * Only ADD COLUMN operations; never DROP or MODIFY (data integrity).
 * Mapping rows with name not in existingColumnNames become ADD operations.
 */
export function computeAlterTableOperations(
  mapping: TableColumn[],
  existingColumnNames: string[]
): { add: AlterTableAddOperation[] } {
  const existingSet = new Set(existingColumnNames.map((n) => n.trim()))
  const add: AlterTableAddOperation[] = []
  for (const col of mapping) {
    const name = (col.name || '').trim()
    if (!name) continue
    if (existingSet.has(name)) continue
    const baseType = (col.type || 'String').replace(/^Nullable\((.*)\)$/, '$1')
    add.push({
      op: 'add',
      name,
      type: baseType,
      nullable: col.isNullable !== false,
    })
  }
  return { add }
}

/**
 * Builds initial mapping rows from event field names and topic schema (create-table path).
 */
export function buildInitialMappingFromEventFields(
  eventFields: string[],
  getJsonType: (field: string) => string | undefined,
): TableColumn[] {
  return eventFields.map((field) => {
    const jsonType = getJsonType(field) || 'string'
    const chType = jsonTypeToClickHouseType(normalizeFieldType(jsonType))
    return {
      name: field,
      type: chType,
      jsonType,
      isNullable: true,
      isKey: false,
      eventField: field,
    }
  })
}
