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

export async function hydrateKafkaTopics(pipelineConfig: any): Promise<void> {
  // 1. Get the Kafka connection from the store (already hydrated)
  const kafkaStore = useStore.getState().kafkaStore

  // 2. Fetch topics from the API (reuse your fetchTopics logic)
  const requestBody = {
    servers: kafkaStore.bootstrapServers,
    securityProtocol: kafkaStore.securityProtocol,
    authMethod: kafkaStore.authMethod,
    // ...add other auth fields as needed
  }

  const response = await fetch('/api/kafka/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch topics')

  console.log('data', data)

  // 3. Set available topics in the store
  useStore.getState().topicsStore.setAvailableTopics(data.topics)

  // 4. Set selected topics from backend config
  if (pipelineConfig?.source?.topics) {
    pipelineConfig.source.topics.forEach((topicConfig: any, idx: number) => {
      // Map topic data (without deduplication)
      const topicState = mapBackendTopicToStore(topicConfig, idx)
      useStore.getState().topicsStore.updateTopic(topicState)

      // Map deduplication data to the new separated store
      const deduplicationState = mapBackendDeduplicationToStore(topicConfig, idx)
      useStore.getState().deduplicationStore.updateDeduplication(idx, deduplicationState)
    })
    // useStore.getState().topicsStore.setTopicCount(pipelineConfig.source.topics.length)
  }
}
