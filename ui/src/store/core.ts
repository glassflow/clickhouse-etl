import { OperationsSelectedType, OutboundEventPreviewType } from '@/src/scheme'
import { Pipeline } from '@/src/types/pipeline'
import Cookies from 'js-cookie'
import { StateCreator } from 'zustand'
import { hydrateKafkaConnection } from './hydration/kafka-connection'
import { hydrateKafkaTopics } from './hydration/topics'
import { hydrateClickhouseConnection } from './hydration/clickhouse-connection'
import { hydrateClickhouseDestination } from './hydration/clickhouse-destination'
import { hydrateJoinConfiguration } from './hydration/join-configuration'

// Helper function to determine topic count based on operation type
export const getTopicCountForOperation = (operation: string): number => {
  switch (operation) {
    case 'joining':
    case 'deduplication_joining':
      return 2 // Join operations need 2 topics
    case 'ingest_only':
    case 'deduplication':
    default:
      return 1 // Simple operations need 1 topic
  }
}

// Mode type for the store
export type StoreMode = 'create' | 'edit' | 'view'

interface CoreStoreProps {
  pipelineId: string
  pipelineName: string
  operationsSelected: OperationsSelectedType
  outboundEventPreview: OutboundEventPreviewType
  analyticsConsent: boolean
  consentAnswered: boolean
  isDirty: boolean
  apiConfig: any
  // New mode-related fields
  mode: StoreMode
  baseConfig: Pipeline | undefined
  // New incremental state management fields
  lastSavedConfig: Pipeline | undefined
  saveHistory: Pipeline[]
}

interface CoreStore extends CoreStoreProps {
  // actions
  setApiConfig: (config: any) => void
  setOperationsSelected: (operations: OperationsSelectedType) => void
  setOutboundEventPreview: (preview: OutboundEventPreviewType) => void
  setAnalyticsConsent: (consent: boolean) => void
  setConsentAnswered: (consent: boolean) => void
  markAsDirty: () => void
  markAsClean: () => void
  setPipelineId: (id: string) => void
  setPipelineName: (name: string) => void
  resetPipelineState: (operation: string, force?: boolean) => void
  // New mode-related actions
  setMode: (mode: StoreMode) => void
  setBaseConfig: (config: Pipeline | undefined) => void
  hydrateFromConfig: (config: Pipeline) => void
  resetToInitial: () => void
  discardChanges: () => void
  enterCreateMode: () => void
  enterEditMode: (config: Pipeline) => void
  enterViewMode: (config: Pipeline) => void
  isDirtyComparedToBase: () => boolean
  // New incremental state management actions
  setLastSavedConfig: (config: Pipeline | undefined) => void
  addToSaveHistory: (config: Pipeline) => void
  getLastSavedConfig: () => Pipeline | undefined
  getSaveHistory: () => Pipeline[]
  clearSaveHistory: () => void
  discardToLastSaved: () => void
  // New section-based hydration actions
  hydrateSection: (section: string, config: Pipeline) => void
  discardSection: (section: string) => void
  discardSections: (sections: string[]) => void
}

export interface CoreSlice {
  coreStore: CoreStore
}

export const initialCoreStore: CoreStoreProps = {
  pipelineId: '',
  pipelineName: '',
  operationsSelected: {
    operation: '',
  },
  outboundEventPreview: {
    events: [],
  },
  analyticsConsent: false,
  consentAnswered: false,
  isDirty: false,
  apiConfig: {},
  // Initialize mode-related fields
  mode: 'create',
  baseConfig: undefined,
  // Initialize incremental state management fields
  lastSavedConfig: undefined,
  saveHistory: [],
}

export const createCoreSlice: StateCreator<CoreSlice> = (set, get) => ({
  coreStore: {
    ...initialCoreStore,
    setPipelineId: (id: string) =>
      set((state) => ({
        coreStore: { ...state.coreStore, pipelineId: id },
      })),
    setPipelineName: (name: string) =>
      set((state) => ({
        coreStore: { ...state.coreStore, pipelineName: name },
      })),
    setOperationsSelected: (operations: OperationsSelectedType) =>
      set((state) => ({
        coreStore: { ...state.coreStore, operationsSelected: operations },
      })),
    setAnalyticsConsent: (consent: boolean) =>
      set((state) => ({
        coreStore: { ...state.coreStore, analyticsConsent: consent },
      })),
    setConsentAnswered: (consent: boolean) =>
      set((state) => ({
        coreStore: { ...state.coreStore, consentAnswered: consent },
      })),
    setOutboundEventPreview: (preview: OutboundEventPreviewType) =>
      set((state) => ({
        coreStore: { ...state.coreStore, outboundEventPreview: preview },
      })),
    markAsDirty: () => {
      set((state) => ({
        coreStore: { ...state.coreStore, isDirty: true },
      }))
      Cookies.set('isDirty', 'true', { expires: 1 })
    },
    markAsClean: () => {
      set((state) => ({
        coreStore: { ...state.coreStore, isDirty: false },
      }))
      Cookies.set('isDirty', 'false', { expires: 1 })
    },
    setApiConfig: (config: any) =>
      set((state) => ({
        coreStore: { ...state.coreStore, apiConfig: config },
      })),
    resetPipelineState: (operation: string, force = false) => {
      const state = get()
      const currentConfig = state.coreStore

      if (force || (currentConfig.isDirty && operation !== currentConfig.operationsSelected.operation)) {
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            operationsSelected: {
              operation: operation,
            },
            outboundEventPreview: {
              events: [],
            },
            isDirty: false,
          },
        }))
      } else {
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            operationsSelected: {
              operation: operation,
            },
          },
        }))
      }
    },
    // New mode-related methods
    setMode: (mode: StoreMode) =>
      set((state) => ({
        coreStore: { ...state.coreStore, mode },
      })),
    setBaseConfig: (config: Pipeline | undefined) =>
      set((state) => ({
        coreStore: { ...state.coreStore, baseConfig: config },
      })),
    hydrateFromConfig: (config: Pipeline) => {
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          pipelineId: config.pipeline_id,
          pipelineName: config.name,
          isDirty: false,
        },
      }))
      // Use the new hydrateSection method for consistency
      const currentState = get()
      currentState.coreStore.hydrateSection('all', config)
    },
    resetToInitial: () => {
      const state = get()
      const { baseConfig } = state.coreStore

      if (baseConfig) {
        // Re-hydrate from baseConfig
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            pipelineId: baseConfig.pipeline_id,
            pipelineName: baseConfig.name,
            // Reset other fields to initial state
            operationsSelected: {
              operation: '',
            },
            outboundEventPreview: {
              events: [],
            },
            analyticsConsent: false,
            consentAnswered: false,
            isDirty: false,
            apiConfig: {},
          },
        }))
      }
    },
    discardChanges: () => {
      const state = get()
      const { baseConfig } = state.coreStore

      if (baseConfig) {
        // Re-hydrate all slices from baseConfig
        state.coreStore.resetToInitial()
      }
    },
    enterCreateMode: () => {
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          ...initialCoreStore,
          mode: 'create',
          baseConfig: undefined,
          lastSavedConfig: undefined,
          saveHistory: [],
        },
      }))
    },
    enterEditMode: (config: Pipeline) => {
      // Determine operation type from pipeline configuration
      const determineOperationType = (pipeline: Pipeline): string => {
        const topics = pipeline?.source?.topics || []
        const hasJoin = pipeline?.join?.enabled || false

        const isTopicDedup = (t: any): boolean => {
          const d = t?.deduplication
          const enabled = d?.enabled === true
          const hasKey = typeof d?.id_field === 'string' && d.id_field.trim() !== ''
          return enabled && hasKey
        }

        if (topics.length === 1 && !hasJoin) {
          // Check if deduplication is enabled WITH a valid key
          const hasDedup = isTopicDedup(topics[0])
          return hasDedup ? 'deduplication' : 'ingest-only'
        } else if (topics.length > 1 && hasJoin) {
          // Check if BOTH topics have deduplication enabled WITH valid keys
          const leftTopicDedup = isTopicDedup(topics[0])
          const rightTopicDedup = isTopicDedup(topics[1])

          if (leftTopicDedup && rightTopicDedup) {
            return 'deduplication-joining'
          } else {
            return 'joining'
          }
        }

        return 'ingest-only' // Default fallback
      }

      const operationType = determineOperationType(config)

      set((state) => ({
        coreStore: {
          ...state.coreStore,
          mode: 'edit',
          baseConfig: config,
          lastSavedConfig: config, // Initialize lastSavedConfig with the loaded config
          saveHistory: [config], // Initialize saveHistory with the loaded config
          operationsSelected: {
            operation: operationType,
          },
        },
      }))
      // Hydrate the store with the config
      const newState = get()
      newState.coreStore.hydrateFromConfig(config)
    },
    enterViewMode: (config: Pipeline) => {
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          mode: 'view',
          baseConfig: config,
          lastSavedConfig: config, // Initialize lastSavedConfig with the loaded config
          saveHistory: [config], // Initialize saveHistory with the loaded config
        },
      }))
      // Hydrate the store with the config
      const newState = get()
      newState.coreStore.hydrateFromConfig(config)
    },
    // Utility to compute dirty state by comparing draft vs base
    isDirtyComparedToBase: () => {
      const state = get()
      const { baseConfig, pipelineId, pipelineName } = state.coreStore

      if (!baseConfig) return false

      // Compare core fields with base config
      return pipelineId !== baseConfig.pipeline_id || pipelineName !== baseConfig.name
    },
    // New incremental state management methods
    setLastSavedConfig: (config: Pipeline | undefined) =>
      set((state) => ({
        coreStore: { ...state.coreStore, lastSavedConfig: config },
      })),
    addToSaveHistory: (config: Pipeline) =>
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          saveHistory: [...state.coreStore.saveHistory, config],
          lastSavedConfig: config,
        },
      })),
    getLastSavedConfig: () => {
      const state = get()
      return state.coreStore.lastSavedConfig
    },
    getSaveHistory: () => {
      const state = get()
      return state.coreStore.saveHistory
    },
    clearSaveHistory: () =>
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          saveHistory: [],
          lastSavedConfig: undefined,
        },
      })),
    discardToLastSaved: () => {
      const state = get()
      const { lastSavedConfig } = state.coreStore

      if (lastSavedConfig) {
        // Re-hydrate all slices from lastSavedConfig instead of baseConfig
        state.coreStore.hydrateFromConfig(lastSavedConfig)
        set((state) => ({
          coreStore: { ...state.coreStore, isDirty: false },
        }))
      }
    },
    // New section-based hydration methods
    hydrateSection: (section: string, config: Pipeline) => {
      switch (section) {
        case 'kafka':
          hydrateKafkaConnection(config)
          break
        case 'topics':
          hydrateKafkaTopics(config)
          break
        case 'deduplication':
          // Topics and deduplication are closely related, so hydrate both
          hydrateKafkaTopics(config)
          break
        case 'join':
          hydrateJoinConfiguration(config)
          break
        case 'clickhouse-connection':
          hydrateClickhouseConnection(config)
          break
        case 'clickhouse-destination':
          hydrateClickhouseDestination(config)
          break
        case 'all':
          // Hydrate all sections (current behavior)
          hydrateKafkaConnection(config)
          hydrateKafkaTopics(config)
          hydrateClickhouseConnection(config)
          hydrateClickhouseDestination(config)
          hydrateJoinConfiguration(config)
          break
        default:
          console.warn(`Unknown section for hydration: ${section}`)
      }
    },
    discardSection: (section: string) => {
      const state = get()
      const { lastSavedConfig } = state.coreStore

      if (lastSavedConfig) {
        // Hydrate only the specific section from lastSavedConfig
        state.coreStore.hydrateSection(section, lastSavedConfig)
        console.log(`Discarded changes for section: ${section}`)
      } else {
        console.warn('No lastSavedConfig available for section discard')
      }
    },
    discardSections: (sections: string[]) => {
      const state = get()
      const { lastSavedConfig } = state.coreStore

      if (lastSavedConfig) {
        // Hydrate each section from lastSavedConfig
        sections.forEach((section) => {
          state.coreStore.hydrateSection(section, lastSavedConfig)
        })
        console.log(`Discarded changes for sections: ${sections.join(', ')}`)
      } else {
        console.warn('No lastSavedConfig available for sections discard')
      }
    },
  },
})
