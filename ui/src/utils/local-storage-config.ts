import { useStore } from '@/src/store'
import { structuredLogger } from '@/src/observability'

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
      operationsSelected: store.coreStore.operationsSelected,
      outboundEventPreview: store.coreStore.outboundEventPreview,
      analyticsConsent: store.coreStore.analyticsConsent,
      consentAnswered: store.coreStore.consentAnswered,
      isDirty: store.coreStore.isDirty,
      apiConfig: store.coreStore.apiConfig,
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
    structuredLogger.error('Error getting configurations from local storage', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

export function deleteConfiguration(id: string): void {
  try {
    const configs = getConfigurations()
    const updatedConfigs = configs.filter((config) => config.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfigs))
  } catch (error) {
    structuredLogger.error('Error deleting configuration from local storage', { error: error instanceof Error ? error.message : String(error) })
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
    store.coreStore.setOperationsSelected(config.state.operationsSelected)
    store.coreStore.setOutboundEventPreview(config.state.outboundEventPreview)
    store.coreStore.setAnalyticsConsent(config.state.analyticsConsent)
    store.coreStore.setConsentAnswered(config.state.consentAnswered)
    store.coreStore.markAsDirty() // or markAsClean based on isDirty
    store.coreStore.setApiConfig(config.state.apiConfig)

    // Restore slice states
    Object.assign(store.kafkaStore, config.state.kafkaStore)
    Object.assign(store.clickhouseConnectionStore, config.state.clickhouseConnectionStore)
    Object.assign(store.clickhouseDestinationStore, config.state.clickhouseDestinationStore)
    Object.assign(store.topicsStore, config.state.topicsStore)
    Object.assign(store.joinStore, config.state.joinStore)
  } catch (error) {
    structuredLogger.error('Error restoring configuration from local storage', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}
