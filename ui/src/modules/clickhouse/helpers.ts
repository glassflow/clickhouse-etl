import { v4 as uuidv4 } from 'uuid'
import { KafkaConnectionParams } from './types'

// Generate API config without updating the store
export const generateApiConfig = ({
  pipelineId,
  setPipelineId,
  clickhouseConnection,
  clickhouseDestination,
  selectedTopics,
  getMappingType,
  joinStore,
  kafkaStore,
}: {
  pipelineId: string
  setPipelineId: (pipelineId: string) => void
  clickhouseConnection: any
  clickhouseDestination: any
  selectedTopics: any
  getMappingType: (eventField: string, mapping: any) => string
  joinStore: any
  kafkaStore: any
}) => {
  try {
    // Generate a new pipeline ID if one doesn't exist
    let finalPipelineId = pipelineId
    if (!finalPipelineId) {
      finalPipelineId = uuidv4()
      setPipelineId(finalPipelineId)
    }

    const mapping = clickhouseDestination?.mapping || []

    // Map topics to the expected format
    const topicsConfig = selectedTopics.map((topic: any) => {
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

      return {
        consumer_group_initial_offset: topic.initialOffset,
        name: topic.name,
        id: topic.name, // Using topic name as id for now
        schema: {
          type: 'json',
          fields: extractEventFields(eventData).map((fieldPath) => {
            const mappingType = getMappingType(fieldPath, mapping)
            const inferredType = getFieldType(eventData, fieldPath)

            return {
              name: fieldPath,
              type: mappingType || inferredType,
            }
          }),
        },
        deduplication:
          topic.deduplication && topic.deduplication.enabled
            ? {
                enabled: true,
                id_field: topic.deduplication.key,
                id_field_type: topic.deduplication.keyType,
                time_window: topic.deduplication.window
                  ? `${topic.deduplication.window}${topic.deduplication.windowUnit?.charAt(0) || 'h'}`
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

            return {
              source_id: sourceId,
              field_name: mapping.eventField,
              column_name: mapping.name,
              column_type: mapping.type.replace(/Nullable\((.*)\)/, '$1'), // Remove Nullable wrapper
            }
          })
      : []

    // Build the complete API config
    const config = {
      pipeline_id: finalPipelineId,
      source: {
        type: 'kafka',
        provider: 'custom', // Or determine from connection details
        connection_params: {
          brokers: kafkaStore?.bootstrapServers?.split(',') || [],
          protocol: kafkaStore?.securityProtocol || 'PLAINTEXT',
          skip_auth: kafkaStore?.skipAuth || false,
        } as KafkaConnectionParams,
        topics: topicsConfig,
      },
      // Include join configuration if multiple topics
      ...(topicsConfig.length > 1
        ? {
            join: {
              enabled: joinStore.enabled,
              type: joinStore.type || 'temporal',
              sources:
                joinStore.streams.length > 0
                  ? joinStore.streams.map((stream: any) => ({
                      // source_id: stream.streamId,
                      source_id: stream.topicName,
                      join_key: stream.joinKey,
                      time_window: `${stream.joinTimeWindowValue}${stream.joinTimeWindowUnit.charAt(0)}`,
                      orientation: stream.orientation,
                    }))
                  : topicsConfig.map((topic: any, index: number) => ({
                      source_id: topic.name,
                      join_key:
                        (topic.deduplication as any)?.key ||
                        (topic.deduplication as any)?.keyField ||
                        topic.deduplication?.id_field ||
                        '',
                      time_window: '1h',
                      orientation: index === 0 ? 'left' : 'right',
                    })),
            },
          }
        : {}),
      sink: {
        type: 'clickhouse',
        provider: 'custom', // Or determine from connection details
        ...(clickhouseConnection?.connectionType === 'direct'
          ? {
              host: clickhouseConnection.directConnection?.host,
              port: clickhouseConnection.directConnection?.nativePort?.toString() || '8443',
              database: clickhouseDestination?.database,
              username: clickhouseConnection.directConnection?.username,
              password: encodeBase64(clickhouseConnection.directConnection?.password),
              secure: clickhouseConnection.directConnection?.useSSL || false,
              skip_certificate_verification:
                clickhouseConnection.directConnection?.skipCertificateVerification || false,
              max_batch_size: clickhouseDestination?.maxBatchSize || 1000,
              max_delay_time: `${clickhouseDestination?.maxDelayTime}${clickhouseDestination?.maxDelayTimeUnit}`,
            }
          : {}),
        table: clickhouseDestination?.table,
        table_mapping: tableMappings,
      },
    }

    // Add authentication parameters based on security protocol
    if (kafkaStore?.securityProtocol === 'SASL_PLAINTEXT' || kafkaStore?.securityProtocol === 'SASL_SSL') {
      const authMethod = kafkaStore.authMethod?.toLowerCase()

      if (authMethod?.includes('plain')) {
        config.source.connection_params = {
          ...config.source.connection_params,
          mechanism: 'PLAIN',
          username: kafkaStore.saslPlain?.username,
          // password: encodeBase64(kafkaStore.saslPlain?.password),
          password: kafkaStore.saslPlain?.password,
        }
      } else if (authMethod?.includes('scram')) {
        const scramType = authMethod.includes('256') ? 'SCRAM-SHA-256' : 'SCRAM-SHA-512'
        const scramConfig = authMethod.includes('256') ? kafkaStore.saslScram256 : kafkaStore.saslScram512

        config.source.connection_params = {
          ...config.source.connection_params,
          mechanism: scramType,
          username: scramConfig?.username,
          // password: encodeBase64(scramConfig?.password),
          password: scramConfig?.password,
          root_ca: encodeBase64(kafkaStore.saslScram256?.certificate || kafkaStore.saslScram512?.certificate || ''),
        }
      } else if (authMethod?.includes('oauth')) {
        config.source.connection_params = {
          ...config.source.connection_params,
          mechanism: 'OAUTHBEARER',
          oauthBearerToken: kafkaStore.saslOauthbearer?.oauthBearerToken,
        }
      }

      // Add SSL certificate if using SSL
      if (kafkaStore?.securityProtocol === 'SASL_SSL' && kafkaStore.truststore?.certificates) {
        config.source.connection_params = {
          ...config.source.connection_params,
          root_ca: encodeBase64(kafkaStore.truststore.certificates),
        }
      }
    }

    return config
  } catch (error) {
    console.error('Error generating API config:', error)
    return { error: 'Failed to generate API configuration' }
  }
}

const encodeBase64 = (password: string) => {
  return password ? Buffer.from(password).toString('base64') : undefined
}

// Helper function to infer JSON type
export function inferJsonType(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'number') {
    // Check if it's an integer
    if (Number.isInteger(value)) {
      // Determine the integer type based on value range
      if (value >= 0) {
        // Unsigned integers
        if (value <= 255) return 'uint8'
        if (value <= 65535) return 'uint16'
        if (value <= 4294967295) return 'uint32'
        if (value <= Number.MAX_SAFE_INTEGER) return 'uint64'
        return 'string' // For numbers larger than MAX_SAFE_INTEGER, use string
      } else {
        // Signed integers
        if (value >= -128 && value <= 127) return 'int8'
        if (value >= -32768 && value <= 32767) return 'int16'
        if (value >= -2147483648 && value <= 2147483647) return 'int32'
        if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) return 'int64'
        return 'string' // For numbers smaller than MIN_SAFE_INTEGER, use string
      }
    } else {
      // It's a floating point number
      // Use a heuristic to determine if it needs float64 precision
      const absValue = Math.abs(value)
      if (absValue < 3.4e38 && absValue > 1.2e-38) return 'float32'
      return 'float64'
    }
  }

  if (type === 'boolean') return 'bool'

  if (type === 'string') {
    // Try to infer if this string might represent a specific type
    // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'string' // UUID pattern
    }

    // ISO date pattern
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
      return 'string' // Date or DateTime pattern
    }

    return 'string'
  }

  if (Array.isArray(value)) return 'array'

  // For objects, return object type
  return 'object'
}

// Helper function to extract fields from event data with support for nested objects and arrays
export const extractEventFields = (data: any, prefix = ''): string[] => {
  if (!data || typeof data !== 'object') {
    return []
  }

  let fields: string[] = []

  Object.keys(data).forEach((key) => {
    // Skip _metadata and key fields
    if (key.startsWith('_metadata')) {
      return
    }

    const fullPath = prefix ? `${prefix}.${key}` : key
    const value = data[key]

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively extract nested fields
      const nestedFields = extractEventFields(value, fullPath)
      fields = [...fields, ...nestedFields]
    } else if (Array.isArray(value)) {
      // Only add the array field itself for cases where users want the whole array
      fields.push(fullPath)
    } else {
      // Only add leaf fields (fields with primitive values, not objects)
      fields.push(fullPath)
    }
  })

  return fields
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
  return inferJsonType(value)
}

/**
 * Maps JSON/Kafka types to compatible ClickHouse types
 */
export const TYPE_COMPATIBILITY_MAP: Record<string, string[]> = {
  // Kafka types
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
  int8: ['Int8'],
  int16: ['Int16'],
  int32: ['Int32'],
  int64: ['Int64', 'DateTime', 'DateTime64'],
  float32: ['Float32'],
  float64: ['Float64', 'DateTime', 'DateTime64'],
  bool: ['Bool'],
  bytes: ['String'],

  // Additional JSON types
  int: ['Int8', 'Int16', 'Int32', 'Int64'],
  float: ['Float32', 'Float64'],
  uint8: ['UInt8'],
  uint16: ['UInt16'],
  uint32: ['UInt32'],
  uint64: ['UInt64'],
  uint: ['UInt8', 'UInt16', 'UInt32', 'UInt64'],

  // JavaScript types that might come from inferJsonType
  number: [
    'Int8',
    'Int16',
    'Int32',
    'Int64',
    'UInt8',
    'UInt16',
    'UInt32',
    'UInt64',
    'Float32',
    'Float64',
    'Decimal',
    'DateTime',
    'DateTime64',
  ],
  boolean: ['Bool'],
  object: ['String'], // Objects will be serialized to JSON strings
  array: ['Array', 'String'], // Arrays might be handled specially or serialized to strings
  null: ['Nullable'], // Special case
  undefined: ['Nullable'], // Special case
}

/**
 * Checks if a source type (Kafka/JSON) is compatible with a ClickHouse column type
 * @param sourceType The source data type (Kafka/JSON)
 * @param clickhouseType The ClickHouse column type
 * @returns boolean indicating if the types are compatible
 */
export function isTypeCompatible(sourceType: string | undefined, clickhouseType: string): boolean {
  // If no source type provided, we consider it incompatible
  if (!sourceType) return false

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

export const generatePipelineId = (pipelineName: string, existingIds: string[] = []): string => {
  // Convert pipeline name to lowercase and replace spaces/special chars with dashes
  const baseId = pipelineName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash

  if (!existingIds.includes(baseId)) {
    return baseId
  }

  // Find existing numbered versions
  const basePattern = new RegExp(`^${baseId}(-\\d+)?$`)
  const numberedVersions = existingIds
    .filter((id) => basePattern.test(id))
    .map((id) => {
      const match = id.match(/-(\d+)$/)
      return match ? parseInt(match[1]) : 0
    })

  // Get the highest number used
  const maxNumber = Math.max(0, ...numberedVersions)

  // Return next available number
  return `${baseId}-${maxNumber + 1}`
}
