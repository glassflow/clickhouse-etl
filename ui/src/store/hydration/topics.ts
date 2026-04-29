import { useStore } from '../index'
import { structuredLogger } from '@/src/observability'

// Helper to map backend topic config to your store's topic shape (without deduplication)
function mapBackendTopicToStore(topicConfig: any, index: number) {
  const initialOffset = topicConfig.consumer_group_initial_offset || 'latest'

  // Map backend schema to store schema format (for verified types from type verification step)
  // Backend format: { type: 'json', fields: [{ name, type }] }
  // Store format: { fields: [{ name, type, inferredType?, userType? }] }
  let schema = undefined
  if (topicConfig.schema?.fields && Array.isArray(topicConfig.schema.fields)) {
    schema = {
      fields: topicConfig.schema.fields.map((f: any) => ({
        name: f.name,
        type: f.type || 'string',
        // userType is same as type when loaded from backend (user verified this)
        userType: f.type || 'string',
      })),
    }
  }

  // When hydrating from backend JSON, a non-empty schema_registry.url means the topic
  // was saved with a registry schema. We use 'external' since we can't distinguish
  // between manual selection and auto-resolved at this point.
  // NOTE: schemaRegistrySubject is not stored in pipeline JSON — requires re-selection on edit.
  const schemaSource = topicConfig.schema_registry?.url ? 'external' : 'internal'

  return {
    index,
    name: topicConfig.name,
    initialOffset,
    events: [] as Array<{ event: any; topicIndex: number; position: string }>,
    selectedEvent: {
      topicIndex: index,
      position: initialOffset,
      event: undefined,
    },
    replicas: topicConfig.replicas || 1,
    partitionCount: topicConfig.partition_count || 1,
    schema, // Include verified schema types from backend
    schemaSource: schemaSource as 'internal' | 'external' | 'registry_resolved_from_event',
    schemaRegistryVersion: topicConfig.schema_version,
  }
}

// Helper to map backend deduplication config to the new deduplication store
function mapBackendDeduplicationToStore(topicConfig: any) {
  if (!topicConfig.deduplication) {
    return {
      enabled: false,
      window: 0,
      unit: 'hours' as const,
      key: '',
      keyType: 'string',
    }
  }

  // Parse Go duration format (e.g., "3m0s", "12h", "1d") to extract value and unit
  const timeWindow = topicConfig.deduplication.time_window || '1h'

  let window = 1
  let unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'hours'

  // Parse Go duration format - it can be complex like "3m0s", "1h30m", "2d12h", etc.
  // We'll normalize to the largest unit that makes sense for the UI
  const durationMatch = timeWindow.match(/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/)

  if (durationMatch) {
    const days = parseInt(durationMatch[1]?.replace('d', '') || '0') || 0
    const hours = parseInt(durationMatch[2]?.replace('h', '') || '0') || 0
    const minutes = parseInt(durationMatch[3]?.replace('m', '') || '0') || 0
    const seconds = parseInt(durationMatch[4]?.replace('s', '') || '0') || 0

    // Convert to total seconds for easier calculation
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds

    // Normalize to the largest appropriate unit for UI display
    if (totalSeconds >= 86400) {
      // 1 day or more - use days
      window = Math.round(totalSeconds / 86400)
      unit = 'days'
    } else if (totalSeconds >= 3600) {
      // 1 hour or more - use hours
      window = Math.round(totalSeconds / 3600)
      unit = 'hours'
    } else if (totalSeconds >= 60) {
      // 1 minute or more - use minutes
      window = Math.round(totalSeconds / 60)
      unit = 'minutes'
    } else {
      // Less than 1 minute - use seconds
      window = totalSeconds
      unit = 'seconds'
    }
  } else {
    // Fallback: try to parse as simple format (e.g., "12h", "30m")
    const simpleMatch = timeWindow.match(/^(\d+)([smhd])$/)
    if (simpleMatch) {
      window = parseInt(simpleMatch[1]) || 1
      const unitLetter = simpleMatch[2]

      switch (unitLetter) {
        case 's':
          unit = 'seconds'
          break
        case 'm':
          unit = 'minutes'
          break
        case 'h':
          unit = 'hours'
          break
        case 'd':
          unit = 'days'
          break
        default:
          unit = 'hours'
      }
    }
  }

  return {
    enabled: topicConfig.deduplication.enabled,
    key: topicConfig.deduplication.id_field,
    keyType: topicConfig.deduplication.id_field_type,
    window,
    unit,
  }
}

// Helper function to validate if kafkaStore has been properly hydrated
function validateKafkaStoreHydration(kafkaStore: any): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  if (!kafkaStore.bootstrapServers || kafkaStore.bootstrapServers.trim() === '') {
    missingFields.push('bootstrapServers')
  }

  if (!kafkaStore.securityProtocol || kafkaStore.securityProtocol.trim() === '') {
    missingFields.push('securityProtocol')
  }

  if (!kafkaStore.authMethod || kafkaStore.authMethod.trim() === '') {
    missingFields.push('authMethod')
  }

  // Validate auth-specific requirements
  if (kafkaStore.authMethod === 'SASL/PLAIN') {
    if (!kafkaStore.saslPlain.username || kafkaStore.saslPlain.username.trim() === '') {
      missingFields.push('saslPlain.username')
    }
    if (!kafkaStore.saslPlain.password || kafkaStore.saslPlain.password.trim() === '') {
      missingFields.push('saslPlain.password')
    }
  } else if (kafkaStore.authMethod === 'SASL/SCRAM-256') {
    if (!kafkaStore.saslScram256.username || kafkaStore.saslScram256.username.trim() === '') {
      missingFields.push('saslScram256.username')
    }
    if (!kafkaStore.saslScram256.password || kafkaStore.saslScram256.password.trim() === '') {
      missingFields.push('saslScram256.password')
    }
  } else if (kafkaStore.authMethod === 'SASL/SCRAM-512') {
    if (!kafkaStore.saslScram512.username || kafkaStore.saslScram512.username.trim() === '') {
      missingFields.push('saslScram512.username')
    }
    if (!kafkaStore.saslScram512.password || kafkaStore.saslScram512.password.trim() === '') {
      missingFields.push('saslScram512.password')
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

// Helper function to wait for kafkaStore to be properly hydrated
async function waitForKafkaStoreHydration(maxRetries = 5, retryDelayMs = 100): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const kafkaStore = useStore.getState().kafkaStore
    const validation = validateKafkaStoreHydration(kafkaStore)

    if (validation.isValid) {
      return
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }

  const kafkaStore = useStore.getState().kafkaStore
  const validation = validateKafkaStoreHydration(kafkaStore)
  throw new Error(`Kafka store hydration timeout. Missing fields: ${validation.missingFields.join(', ')}`)
}

export async function hydrateKafkaTopics(pipelineConfig: any): Promise<void> {
  try {
    // 1. Normalise config shapes into a single topics array FIRST — before any connection checks.
    // This allows config-only hydration to succeed even when there is no live Kafka connection
    // (e.g. during pipeline import from a config file).
    // v3: sources[] at root, each entry is one topic; dedup lives in transforms[].
    // legacy: source.topics[] with embedded deduplication objects.
    const legacyTopics: any[] | undefined = pipelineConfig?.source?.topics
    const v3Sources: any[] | undefined = Array.isArray(pipelineConfig?.sources) ? pipelineConfig.sources : undefined
    const topicsToHydrate: any[] | undefined = v3Sources
      ? v3Sources.map((src: any) => {
          const dedupTransform = (pipelineConfig?.transforms ?? []).find(
            (t: any) => t.type === 'dedup' && t.source_id === src.source_id,
          )
          return {
            name: src.topic,
            consumer_group_initial_offset: 'latest',
            schema: src.schema_fields?.length
              ? { fields: src.schema_fields.map((f: any) => ({ name: f.name, type: f.type ?? 'string' })) }
              : undefined,
            deduplication: dedupTransform
              ? { enabled: true, id_field: dedupTransform.config?.key ?? '', id_field_type: 'string', time_window: dedupTransform.config?.time_window ?? '1h' }
              : undefined,
          }
        })
      : legacyTopics

    // 2. Attempt live Kafka operations (topic list, partition counts, event sampling).
    // These are best-effort: if the kafkaStore isn't fully populated (e.g. import without a
    // live broker), we skip them and fall back to config-only hydration.
    let hasLiveConnection = false
    let detailsData: any = null
    let requestBody: any = null

    try {
      await waitForKafkaStoreHydration()

      const kafkaStore = useStore.getState().kafkaStore
      requestBody = {
        servers: kafkaStore.bootstrapServers,
        securityProtocol: kafkaStore.securityProtocol,
        authMethod: kafkaStore.authMethod,
      }

      switch (kafkaStore.authMethod) {
        case 'SASL/PLAIN':
          requestBody.username = kafkaStore.saslPlain.username
          requestBody.password = kafkaStore.saslPlain.password
          requestBody.consumerGroup = kafkaStore.saslPlain.consumerGroup
          if (kafkaStore.saslPlain?.truststore?.certificates) {
            requestBody.certificate = kafkaStore.saslPlain.truststore.certificates
          }
          if (kafkaStore.saslPlain?.truststore?.skipTlsVerification) {
            requestBody.skipTlsVerification = true
          }
          break
        case 'SASL/SCRAM-256':
          requestBody.username = kafkaStore.saslScram256.username
          requestBody.password = kafkaStore.saslScram256.password
          requestBody.consumerGroup = kafkaStore.saslScram256.consumerGroup
          if (kafkaStore.saslScram256?.truststore?.certificates) {
            requestBody.certificate = kafkaStore.saslScram256.truststore.certificates
          }
          if (kafkaStore.saslScram256?.truststore?.skipTlsVerification) {
            requestBody.skipTlsVerification = true
          }
          break
        case 'SASL/SCRAM-512':
          requestBody.username = kafkaStore.saslScram512.username
          requestBody.password = kafkaStore.saslScram512.password
          if (kafkaStore.saslScram512?.truststore?.certificates) {
            requestBody.certificate = kafkaStore.saslScram512.truststore.certificates
          }
          if (kafkaStore.saslScram512?.truststore?.skipTlsVerification) {
            requestBody.skipTlsVerification = true
          }
          break
        case 'SASL/GSSAPI':
          if (kafkaStore.saslGssapi?.truststore?.certificates) {
            requestBody.certificate = kafkaStore.saslGssapi.truststore.certificates
          }
          if (kafkaStore.saslGssapi?.truststore?.skipTlsVerification) {
            requestBody.skipTlsVerification = true
          }
          break
        case 'NO_AUTH':
          if (kafkaStore.noAuth?.truststore?.certificates) {
            requestBody.certificate = kafkaStore.noAuth.truststore.certificates
          }
          if (kafkaStore.noAuth?.truststore?.skipTlsVerification) {
            requestBody.skipTlsVerification = true
          }
          break
      }

      const [topicsResponse, detailsResponse] = await Promise.all([
        fetch('/ui-api/kafka/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }),
        fetch('/ui-api/kafka/topic-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }),
      ])

      const topicsData = await topicsResponse.json()
      if (!topicsData.success) throw new Error(topicsData.error || 'Failed to fetch topics')

      const detailsDataRaw = await detailsResponse.json()
      if (!detailsDataRaw.success) throw new Error(detailsDataRaw.error || 'Failed to fetch topic details')

      useStore.getState().topicsStore.setAvailableTopics(topicsData.topics)
      detailsData = detailsDataRaw
      hasLiveConnection = true
    } catch {
      // No live connection available — proceed with config-only hydration below
    }

    // 3. Set selected topics from config, optionally enriched with live partition counts
    if (topicsToHydrate) {
      topicsToHydrate.forEach((topicConfig: any, idx: number) => {
        const currentPartitionCount =
          hasLiveConnection && detailsData
            ? (detailsData.topicDetails?.find((detail: any) => detail.name === topicConfig.name)?.partitionCount || 1)
            : 1

        const existingTopic = useStore.getState().topicsStore.getTopic(idx)
        const existingEvent = existingTopic?.selectedEvent?.event

        const topicState = mapBackendTopicToStore(topicConfig, idx)
        topicState.partitionCount = currentPartitionCount

        if (existingEvent) {
          topicState.selectedEvent.event = existingEvent
          topicState.events = [
            {
              event: existingEvent,
              topicIndex: idx,
              position: topicConfig.consumer_group_initial_offset || 'latest',
            },
          ]
        }

        useStore.getState().topicsStore.updateTopic(topicState)

        const existingDeduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(idx)
        if (!existingDeduplicationConfig || !existingDeduplicationConfig.key) {
          const deduplicationState = mapBackendDeduplicationToStore(topicConfig)
          useStore.getState().deduplicationStore.updateDeduplication(idx, deduplicationState)
        }
      })

      // 4. Fetch event samples from live Kafka (only when connected; errors are non-fatal)
      if (hasLiveConnection && requestBody) {
        await Promise.all(
          topicsToHydrate.map(async (topicConfig: any, idx: number) => {
            try {
              const currentTopic = useStore.getState().topicsStore.getTopic(idx)
              if (currentTopic?.selectedEvent?.event) {
                return
              }

              const eventResponse = await fetch('/ui-api/kafka/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...requestBody,
                  topic: topicConfig.name,
                  position: topicConfig.consumer_group_initial_offset || 'latest',
                  format: 'JSON',
                }),
              })

              const eventData = await eventResponse.json()

              if (eventData.success && eventData.event) {
                const topic = useStore.getState().topicsStore.getTopic(idx)
                if (topic) {
                  useStore.getState().topicsStore.updateTopic({
                    ...topic,
                    selectedEvent: {
                      topicIndex: idx,
                      position: topicConfig.consumer_group_initial_offset || 'latest',
                      event: eventData.event,
                    },
                    events: [
                      {
                        event: eventData.event,
                        topicIndex: idx,
                        position: topicConfig.consumer_group_initial_offset || 'latest',
                      },
                    ],
                  })
                }
              }
            } catch {
              // Non-fatal — continue hydration even if event fetch fails
            }
          }),
        )
      }

      const topicCount = topicsToHydrate.length
      useStore.getState().topicsStore.setTopicCount(topicCount)
      useStore.getState().coreStore.setTopicCount(topicCount)
    }
  } catch (error) {
    structuredLogger.error('Failed to hydrate Kafka topics', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}
