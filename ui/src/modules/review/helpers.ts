import { v4 as uuidv4 } from 'uuid'
import { KafkaConnectionParams } from './types'

const encodeBase64 = (password: string) => {
  return password ? Buffer.from(password).toString('base64') : undefined
}

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
        const rawEvent = topic.selectedEvent.event.event || topic.selectedEvent.event

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
          fields: Object.keys(eventData).map((key) => {
            const mappingType = getMappingType(key, mapping)
            return {
              name: key,
              type: mappingType,
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
                  const eventData = topic.selectedEvent.event.event || topic.selectedEvent.event

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
              useSSL: clickhouseConnection.directConnection?.useSSL || false,
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

export function isValidApiConfig(config: any): boolean {
  if (!config) return false

  // Check required fields
  const requiredFields = ['pipeline_id', 'source', 'destination']
  if (!requiredFields.every((field) => config[field])) return false

  // Check source configuration
  if (!config.source?.topics || !Array.isArray(config.source.topics) || config.source.topics.length === 0) return false

  // Check destination configuration
  if (!config.destination?.database || !config.destination?.table) return false

  return true
}
