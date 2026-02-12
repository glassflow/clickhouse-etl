import { v4 as uuidv4 } from 'uuid'
import { KafkaConnectionParams, TableColumn } from './types'
import { extractEventFields, getRuntimeEnv } from '@/src/utils/common.client'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import { LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'

const encodeBase64 = (password: string) => {
  return password ? Buffer.from(password).toString('base64') : undefined
}

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
}): InternalPipelineConfig => {
  // Generate a new pipeline ID if one doesn't exist
  let finalPipelineId = pipelineId
  if (!finalPipelineId) {
    finalPipelineId = uuidv4()
    setPipelineId(finalPipelineId)
  }

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

          // If the mapped field is a derived transformation output, use transformation ID as source_id
          // so the column is attributed to the transform in the pipeline schema (same logic as v2 adapter).
          if (transformationStore?.transformationConfig?.enabled && transformationStore.transformationConfig?.fields?.length > 0) {
            const derivedField = transformationStore.transformationConfig.fields.find(
              (f: any) => f.outputFieldName === mapping.eventField && f.type !== 'passthrough',
            )
            if (derivedField) {
              const baseName = (pipelineName || 'transform').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-transform$/, '')
              sourceId = `${baseName}-transform`
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

  // Collect all field_names that are already in the mapping
  const mappedFieldNames = new Set(tableMappings.map((m: any) => `${m.source_id}:${m.field_name}`))

  // Add deduplication keys to mapping if they're not already included
  // These entries have empty column_name and column_type because they're not mapped to ClickHouse,
  // but the backend needs to know they're part of the Kafka schema
  selectedTopics.forEach((topic: any, topicIndex: number) => {
    const deduplicationConfig = deduplicationStore?.getDeduplication?.(topicIndex)
    if (deduplicationConfig?.enabled && deduplicationConfig?.key) {
      const dedupKey = deduplicationConfig.key
      const topicName = topic.name
      const fieldKey = `${topicName}:${dedupKey}`

      // Only add if not already in the mapping
      if (!mappedFieldNames.has(fieldKey)) {
        tableMappings.push({
          source_id: topicName,
          field_name: dedupKey,
          column_name: '',
          column_type: '',
        })
        mappedFieldNames.add(fieldKey)
      }
    }
  })

  // Add join keys to mapping if they're not already included
  // These entries have empty column_name and column_type because they're not mapped to ClickHouse,
  // but the backend needs to know they're part of the Kafka schema
  if (joinStore?.enabled && joinStore?.streams?.length > 0) {
    joinStore.streams.forEach((stream: any) => {
      if (stream.joinKey) {
        const topicName = stream.topicName || stream.streamId
        const fieldKey = `${topicName}:${stream.joinKey}`

        // Only add if not already in the mapping
        if (!mappedFieldNames.has(fieldKey)) {
          tableMappings.push({
            source_id: topicName,
            field_name: stream.joinKey,
            column_name: '',
            column_type: '',
          })
          mappedFieldNames.add(fieldKey)
        }
      }
    })
  }

  // Add filter fields to mapping if they're not already included
  // These entries have empty column_name and column_type because they're not mapped to ClickHouse,
  // but the backend needs to know they're part of the Kafka schema
  if (filterStore?.filterConfig?.enabled && filterStore?.filterConfig?.root) {
    const filterFields = extractFilterFields(filterStore.filterConfig.root)
    // For single-topic pipelines, use the first topic as the source
    const topicName = selectedTopics[0]?.name

    filterFields.forEach((fieldName: string) => {
      const fieldKey = `${topicName}:${fieldName}`

      // Only add if not already in the mapping
      if (!mappedFieldNames.has(fieldKey)) {
        tableMappings.push({
          source_id: topicName,
          field_name: fieldName,
          column_name: '',
          column_type: '',
        })
        mappedFieldNames.add(fieldKey)
      }
    })
  }

  // Normalize Kafka broker hosts when running inside Docker
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

  // Build the complete API config
  // Extract skipTlsVerification from the appropriate truststore based on auth method
  let skipTlsVerification = false
  const authMethod = kafkaStore?.authMethod
  const securityProtocol = kafkaStore?.securityProtocol || 'PLAINTEXT'
  const isTLSEnabled = securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL'

  if (isTLSEnabled) {
    if (authMethod === 'SASL/PLAIN' && kafkaStore?.saslPlain?.truststore) {
      skipTlsVerification = kafkaStore.saslPlain.truststore.skipTlsVerification ?? false
    } else if (authMethod === 'SASL/SCRAM-256' && kafkaStore?.saslScram256?.truststore) {
      skipTlsVerification = kafkaStore.saslScram256.truststore.skipTlsVerification ?? false
    } else if (authMethod === 'SASL/SCRAM-512' && kafkaStore?.saslScram512?.truststore) {
      skipTlsVerification = kafkaStore.saslScram512.truststore.skipTlsVerification ?? false
    } else if (authMethod === 'SASL/GSSAPI' && kafkaStore?.saslGssapi?.truststore) {
      skipTlsVerification = kafkaStore.saslGssapi.truststore.skipTlsVerification ?? false
    } else if (authMethod === 'NO_AUTH' && kafkaStore?.noAuth?.truststore) {
      skipTlsVerification = kafkaStore.noAuth.truststore.skipTlsVerification ?? false
    }
  }

  // Determine mechanism value based on auth method
  let mechanism = ''
  if (authMethod === 'NO_AUTH') {
    mechanism = 'NO_AUTH'
  } else if (authMethod === 'SASL/PLAIN') {
    mechanism = 'PLAIN'
  } else if (authMethod === 'SASL/SCRAM-256') {
    mechanism = 'SCRAM-SHA-256'
  } else if (authMethod === 'SASL/SCRAM-512') {
    mechanism = 'SCRAM-SHA-512'
  } else if (authMethod === 'SASL/GSSAPI') {
    mechanism = 'GSSAPI'
  }

  const connectionParams: any = {
    brokers: (kafkaStore?.bootstrapServers?.split(',') || []).map((b: string) => normalizeBroker(b.trim())),
    protocol: securityProtocol,
    skip_auth: authMethod === 'NO_AUTH', // true for NO_AUTH, false for others
    // sasl_tls_enable: isTLSEnabled,
    mechanism: mechanism || 'NO_AUTH', // Ensure mechanism is always a string, default to NO_AUTH
  }

  // Only include skip_tls_verification when TLS is enabled
  if (isTLSEnabled) {
    connectionParams.skip_tls_verification = skipTlsVerification
  }

  // Add authentication parameters based on auth method
  // Mechanism is already set in base connection_params, only add auth-specific fields
  if (authMethod === 'SASL/PLAIN') {
    connectionParams.username = kafkaStore.saslPlain?.username
    connectionParams.password = kafkaStore.saslPlain?.password

    // Add SSL certificate from truststore if using SSL/TLS
    if (isTLSEnabled) {
      const truststoreCert = kafkaStore.saslPlain?.truststore?.certificates
      if (truststoreCert) {
        connectionParams.root_ca = encodeBase64(truststoreCert)
      }
    }
  } else if (authMethod === 'SASL/SCRAM-256' || authMethod === 'SASL/SCRAM-512') {
    const scramConfig = authMethod === 'SASL/SCRAM-256' ? kafkaStore.saslScram256 : kafkaStore.saslScram512
    connectionParams.username = scramConfig?.username
    connectionParams.password = scramConfig?.password

    // Add SSL certificate from truststore if using SSL/TLS
    if (isTLSEnabled) {
      const truststoreCert = scramConfig?.truststore?.certificates
      if (truststoreCert) {
        connectionParams.root_ca = encodeBase64(truststoreCert)
      }
    }
  } else if (authMethod === 'SASL/GSSAPI') {
    // Backend expects these field names for Kerberos
    connectionParams.username = kafkaStore.saslGssapi?.kerberosPrincipal
    connectionParams.kerberos_service_name = kafkaStore.saslGssapi?.serviceName
    connectionParams.kerberos_realm = kafkaStore.saslGssapi?.kerberosRealm
    connectionParams.kerberos_keytab = kafkaStore.saslGssapi?.kerberosKeytab
    connectionParams.kerberos_config = kafkaStore.saslGssapi?.krb5Config

    // Add SSL certificate from truststore if using SSL/TLS
    if (isTLSEnabled) {
      const truststoreCert = kafkaStore.saslGssapi?.truststore?.certificates
      if (truststoreCert) {
        connectionParams.root_ca = encodeBase64(truststoreCert)
      }
    }
  } else if (authMethod === 'NO_AUTH' && isTLSEnabled) {
    // Handle NO_AUTH with SSL/TLS certificate
    const truststoreCert = kafkaStore.noAuth?.truststore?.certificates
    if (truststoreCert) {
      connectionParams.root_ca = encodeBase64(truststoreCert)
    }
  }

  const config: InternalPipelineConfig = {
    pipeline_id: finalPipelineId,
    name: pipelineName,
    source: {
      type: 'kafka',
      provider: 'custom', // Or determine from connection details
      connection_params: connectionParams as KafkaConnectionParams,
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
                : topicsConfig.map((topic: any, index: number) => {
                    // Get deduplication config for join key
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
        }
      : {
          // Add default empty join object to satisfy type
          join: {
            type: '',
            enabled: false,
            sources: [],
          },
        }),
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
            password: encodeBase64(clickhouseConnection.directConnection?.password),
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
    } as any, // Type assertion to bypass strict checks on conditional properties for now
    // Include filter configuration only for single-topic pipelines
    // Filter is not available for multi-topic journeys
    ...(topicsConfig.length === 1
      ? filterStore?.filterConfig?.enabled && filterStore?.expressionString
        ? {
            filter: {
              enabled: true,
              expression: filterStore.expressionString,
            },
          }
        : {
            filter: {
              enabled: false,
              expression: '',
            },
          }
      : {}),
    // Include transformation configuration only for single-topic pipelines
    // Transformation is not available for multi-topic journeys
    ...(topicsConfig.length === 1
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
  version, // New optional parameter
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
  version?: string
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
    })

    // 2. Get the appropriate adapter
    // Use provided version or fallback to LATEST_PIPELINE_VERSION if not provided
    // If version is passed (e.g. from existing config), we respect it to avoid implicit upgrades
    const targetVersion = version || LATEST_PIPELINE_VERSION
    const adapter = getPipelineAdapter(targetVersion)

    // 3. Generate the external API configuration
    // Note: The adapter handles wrapping the configuration in the correct structure for the target version
    return adapter.generate(internalConfig)
  } catch (error) {
    console.error('Error generating API config:', error)
    return { error: 'Failed to generate API configuration' }
  }
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
