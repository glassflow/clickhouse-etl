import { useStore } from '../index'

// Helper to map backend topic config to your store's topic shape
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
    deduplication: topicConfig.deduplication
      ? {
          enabled: topicConfig.deduplication.enabled,
          key: topicConfig.deduplication.id_field,
          keyType: topicConfig.deduplication.id_field_type,
          window: parseInt(topicConfig.deduplication.time_window) || 0,
          unit: topicConfig.deduplication.time_window?.replace(/[0-9]/g, '') || 'hours',
        }
      : undefined,
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

  // 3. Set available topics in the store
  useStore.getState().topicsStore.setAvailableTopics(data.topics)

  // 4. Set selected topics from backend config
  if (pipelineConfig?.source?.topics) {
    pipelineConfig.source.topics.forEach((topicConfig: any, idx: number) => {
      const topicState = mapBackendTopicToStore(topicConfig, idx)
      useStore.getState().topicsStore.updateTopic(topicState)
    })
    useStore.getState().topicsStore.setTopicCount(pipelineConfig.source.topics.length)
  }
}
