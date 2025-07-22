import { useStore } from '@/src/store'

export interface SavedConfiguration {
  id: string
  name: string
  description?: string
  timestamp: number
  state: {
    operationsSelected: any
    outboundEventPreview: any
    analyticsConsent: boolean
    consentAnswered: boolean
    isDirty: boolean
    apiConfig: any
    kafkaStore: any
    clickhouseConnectionStore: any
    clickhouseDestinationStore: any
    topicsStore: any
    joinStore: any
  }
  metadata: {
    version: string
    user: string
  }
}

const STORAGE_KEY = 'saved_configurations'

export function saveConfiguration(name: string, description?: string): SavedConfiguration {
  const store = useStore.getState()
  const config: SavedConfiguration = {
    id: crypto.randomUUID(),
    name,
    description,
    timestamp: Date.now(),
    state: {
      operationsSelected: store.configStore.operationsSelected,
      outboundEventPreview: store.configStore.outboundEventPreview,
      analyticsConsent: store.configStore.analyticsConsent,
      consentAnswered: store.configStore.consentAnswered,
      isDirty: store.configStore.isDirty,
      apiConfig: store.configStore.apiConfig,
      kafkaStore: store.kafkaStore,
      clickhouseConnectionStore: store.clickhouseConnectionStore,
      clickhouseDestinationStore: store.clickhouseDestinationStore,
      topicsStore: store.topicsStore,
      joinStore: store.joinStore,
    },
    metadata: {
      version: '1.0.0',
      user: 'default',
    },
  }

  const existingConfigs = getConfigurations()
  existingConfigs.push(config)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existingConfigs))

  return config
}

export function getConfigurations(): SavedConfiguration[] {
  try {
    const configs = localStorage.getItem(STORAGE_KEY)
    return configs ? JSON.parse(configs) : []
  } catch (error) {
    console.error('Error getting configurations:', error)
    return []
  }
}

export function deleteConfiguration(id: string): void {
  try {
    const configs = getConfigurations()
    const updatedConfigs = configs.filter((config) => config.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfigs))
  } catch (error) {
    console.error('Error deleting configuration:', error)
  }
}

export function restoreConfiguration(id: string): void {
  try {
    const configs = getConfigurations()
    const config = configs.find((c) => c.id === id)
    if (!config) {
      throw new Error(`Configuration with id ${id} not found`)
    }

    const store = useStore.getState()

    // Restore all store states
    store.configStore.setOperationsSelected(config.state.operationsSelected)
    store.configStore.setOutboundEventPreview(config.state.outboundEventPreview)
    store.configStore.setAnalyticsConsent(config.state.analyticsConsent)
    store.configStore.setConsentAnswered(config.state.consentAnswered)
    store.configStore.markAsDirty() // or markAsClean based on isDirty
    store.configStore.setApiConfig(config.state.apiConfig)

    // Restore slice states
    Object.assign(store.kafkaStore, config.state.kafkaStore)
    Object.assign(store.clickhouseConnectionStore, config.state.clickhouseConnectionStore)
    Object.assign(store.clickhouseDestinationStore, config.state.clickhouseDestinationStore)
    Object.assign(store.topicsStore, config.state.topicsStore)
    Object.assign(store.joinStore, config.state.joinStore)
  } catch (error) {
    console.error('Error restoring configuration:', error)
    throw error
  }
}
