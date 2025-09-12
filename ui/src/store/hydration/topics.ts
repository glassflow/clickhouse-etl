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
      unit: 'hours',
      key: '',
      keyType: 'string',
    }
  }

  return {
    enabled: topicConfig.deduplication.enabled,
    key: topicConfig.deduplication.id_field,
    keyType: topicConfig.deduplication.id_field_type,
    window: parseInt(topicConfig.deduplication.time_window) || 0,
    unit: topicConfig.deduplication.time_window?.replace(/[0-9]/g, '') || 'hours',
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
      pipelineConfig.source.topics.forEach((topicConfig: any, idx: number) => {
        // Find current partition count from Kafka for this topic
        const currentTopicDetails = detailsData.topicDetails?.find((detail: any) => detail.name === topicConfig.name)
        const currentPartitionCount = currentTopicDetails?.partitionCount || 1

        // Map topic data with current partition count from Kafka
        const topicState = mapBackendTopicToStore(topicConfig, idx)
        topicState.partitionCount = currentPartitionCount
        useStore.getState().topicsStore.updateTopic(topicState)

        // Map deduplication data to the new separated store
        const deduplicationState = mapBackendDeduplicationToStore(topicConfig, idx)
        useStore.getState().deduplicationStore.updateDeduplication(idx, deduplicationState)
      })
      // useStore.getState().topicsStore.setTopicCount(pipelineConfig.source.topics.length)
    }
  } catch (error) {
    console.error('❌ Failed to hydrate Kafka topics:', error)
    throw error
  }
}
