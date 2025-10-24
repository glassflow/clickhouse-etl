import { useStore } from '../index'

// Helper to map backend topic config to your store's topic shape (without deduplication)
function mapBackendTopicToStore(topicConfig: any, index: number) {
  const initialOffset = topicConfig.consumer_group_initial_offset || 'latest'
  return {
    index,
    name: topicConfig.name,
    initialOffset,
    events: [],
    selectedEvent: {
      topicIndex: index,
      position: initialOffset,
      event: undefined,
    },
    replicas: topicConfig.replicas || 1,
    partitionCount: topicConfig.partition_count || 1,
  }
}

// Helper to map backend deduplication config to the new deduplication store
function mapBackendDeduplicationToStore(topicConfig: any, index: number) {
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
      console.log('✅ Kafka store properly hydrated, proceeding with topics fetch')
      return
    }

    console.log(
      `⏳ Kafka store not ready (attempt ${attempt + 1}/${maxRetries}), missing: ${validation.missingFields.join(', ')}`,
    )

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
    // 1. Wait for the Kafka connection to be properly hydrated first
    await waitForKafkaStoreHydration()

    // 2. Get the Kafka connection from the store (now guaranteed to be hydrated)
    const kafkaStore = useStore.getState().kafkaStore

    // 3. Build request body with proper auth fields based on auth method
    const requestBody: any = {
      servers: kafkaStore.bootstrapServers,
      securityProtocol: kafkaStore.securityProtocol,
      authMethod: kafkaStore.authMethod,
    }

    // Add auth-specific fields based on the auth method
    switch (kafkaStore.authMethod) {
      case 'SASL/PLAIN':
        requestBody.username = kafkaStore.saslPlain.username
        requestBody.password = kafkaStore.saslPlain.password
        requestBody.consumerGroup = kafkaStore.saslPlain.consumerGroup
        if (kafkaStore.saslPlain.certificate) {
          requestBody.certificate = kafkaStore.saslPlain.certificate
        }
        break
      case 'SASL/SCRAM-256':
        requestBody.username = kafkaStore.saslScram256.username
        requestBody.password = kafkaStore.saslScram256.password
        requestBody.consumerGroup = kafkaStore.saslScram256.consumerGroup
        break
      case 'SASL/SCRAM-512':
        requestBody.username = kafkaStore.saslScram512.username
        requestBody.password = kafkaStore.saslScram512.password
        break
      case 'NO_AUTH':
        if (kafkaStore.noAuth.certificate) {
          requestBody.certificate = kafkaStore.noAuth.certificate
        }
        break
      // Add other auth methods as needed
    }

    // 4. Fetch topics and topic details from the API in parallel
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

    const detailsData = await detailsResponse.json()
    if (!detailsData.success) throw new Error(detailsData.error || 'Failed to fetch topic details')

    // 5. Set available topics in the store
    useStore.getState().topicsStore.setAvailableTopics(topicsData.topics)

    // 6. Set selected topics from backend config with current partition counts
    if (pipelineConfig?.source?.topics) {
      // First, hydrate all topics
      pipelineConfig.source.topics.forEach((topicConfig: any, idx: number) => {
        // Find current partition count from Kafka for this topic
        const currentTopicDetails = detailsData.topicDetails?.find((detail: any) => detail.name === topicConfig.name)
        const currentPartitionCount = currentTopicDetails?.partitionCount || 1

        // Check if topic already exists in store (to preserve event data during re-hydration)
        const existingTopic = useStore.getState().topicsStore.getTopic(idx)
        const existingEvent = existingTopic?.selectedEvent?.event
        const existingReplicas = existingTopic?.replicas

        // Map topic data with current partition count from Kafka
        const topicState = mapBackendTopicToStore(topicConfig, idx)
        topicState.partitionCount = currentPartitionCount

        // ✅ Preserve existing event data if available (prevents clearing on re-hydration)
        if (existingEvent) {
          topicState.selectedEvent.event = existingEvent
          console.log(`[Hydration] Preserving existing event data for topic "${topicConfig.name}"`)
        }

        // ✅ Preserve existing replica count if available (prevents overwriting user changes)
        if (existingReplicas && existingReplicas !== topicState.replicas) {
          topicState.replicas = existingReplicas
          console.log(
            `[Hydration] Preserving user-modified replica count (${existingReplicas}) for topic "${topicConfig.name}"`,
          )
        }

        useStore.getState().topicsStore.updateTopic(topicState)

        // Map deduplication data to the new separated store
        // ✅ Check if deduplication config already exists (to preserve user changes during re-hydration)
        const existingDeduplicationConfig = useStore.getState().deduplicationStore.getDeduplication(idx)

        // Only update deduplication if it doesn't exist yet, or if we're doing initial hydration
        // This preserves user's unsaved changes when entering edit mode
        if (!existingDeduplicationConfig || !existingDeduplicationConfig.key) {
          const deduplicationState = mapBackendDeduplicationToStore(topicConfig, idx)
          useStore.getState().deduplicationStore.updateDeduplication(idx, deduplicationState)
          console.log(`[Hydration] Setting initial deduplication config for topic "${topicConfig.name}"`)
        } else {
          console.log(`[Hydration] Preserving existing deduplication config for topic "${topicConfig.name}"`)
        }
      })

      // 7. Fetch actual event data from Kafka for each topic (only if not already present)
      // This is needed for deduplication, join, and mapping configurations
      console.log('[Hydration] Checking which topics need event data...')
      await Promise.all(
        pipelineConfig.source.topics.map(async (topicConfig: any, idx: number) => {
          try {
            // Check if topic already has event data
            const currentTopic = useStore.getState().topicsStore.getTopic(idx)
            if (currentTopic?.selectedEvent?.event) {
              console.log(
                `[Hydration] ⏭️  Skipping event fetch for topic "${topicConfig.name}" (already has event data)`,
              )
              return // Skip fetch if event data already exists
            }

            console.log(`[Hydration] 📥 Fetching event for topic "${topicConfig.name}"...`)
            const eventResponse = await fetch('/ui-api/kafka/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...requestBody,
                topicName: topicConfig.name,
                offset: topicConfig.consumer_group_initial_offset || 'latest',
                partition: 0,
                format: 'JSON',
              }),
            })

            const eventData = await eventResponse.json()

            if (eventData.success && eventData.event) {
              // Update the topic with the fetched event
              const topic = useStore.getState().topicsStore.getTopic(idx)
              if (topic) {
                useStore.getState().topicsStore.updateTopic({
                  ...topic,
                  selectedEvent: {
                    topicIndex: idx,
                    position: topicConfig.consumer_group_initial_offset || 'latest',
                    event: eventData.event,
                  },
                })
                console.log(`[Hydration] ✅ Fetched event for topic "${topicConfig.name}"`)
              }
            } else {
              console.warn(`[Hydration] ⚠️ Could not fetch event for topic "${topicConfig.name}":`, eventData.error)
            }
          } catch (error) {
            console.error(`[Hydration] ❌ Failed to fetch event for topic "${topicConfig.name}":`, error)
            // Don't throw - continue hydration even if event fetch fails
          }
        }),
      )
      // useStore.getState().topicsStore.setTopicCount(pipelineConfig.source.topics.length)
    }
  } catch (error) {
    console.error('❌ Failed to hydrate Kafka topics:', error)
    throw error
  }
}
