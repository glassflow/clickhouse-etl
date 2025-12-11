import { OperationsSelectedType, OutboundEventPreviewType } from '@/src/scheme'
import { Pipeline } from '@/src/types/pipeline'
import Cookies from 'js-cookie'
import { StateCreator } from 'zustand'
import { trackMode } from '@/src/analytics'
import { hydrateKafkaConnection } from './hydration/kafka-connection'
import { hydrateKafkaTopics } from './hydration/topics'
import { hydrateClickhouseConnection } from './hydration/clickhouse-connection'
import { hydrateClickhouseDestination } from './hydration/clickhouse-destination'
import { hydrateJoinConfiguration } from './hydration/join-configuration'
import { hydrateFilter } from './hydration/filter'

// Helper function to compute operation type from topicCount + deduplication + join state
// This is used for backward compatibility (analytics, display, etc.)
export const computeOperationType = (
  topicCount: number,
  deduplicationConfigs: Record<number, { enabled: boolean; key: string }>,
  hasJoin: boolean,
): string => {
  if (topicCount === 1 && !hasJoin) {
    // Single topic: check if deduplication is enabled
    const dedup0 = deduplicationConfigs[0]
    const hasDedup = dedup0?.enabled && dedup0?.key?.trim().length > 0
    return hasDedup ? 'deduplication' : 'ingest-only'
  } else if (topicCount === 2 && hasJoin) {
    // Two topics with join: check deduplication on both
    const dedup0 = deduplicationConfigs[0]
    const dedup1 = deduplicationConfigs[1]
    const leftTopicDedup = dedup0?.enabled && dedup0?.key?.trim().length > 0
    const rightTopicDedup = dedup1?.enabled && dedup1?.key?.trim().length > 0

    if (leftTopicDedup && rightTopicDedup) {
      return 'deduplication-joining'
    } else {
      return 'joining'
    }
  }

  return 'ingest-only' // Default fallback
}

// Helper function to determine operation type from pipeline configuration
// Used when loading existing pipelines
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

// Mode type for the store
export type StoreMode = 'create' | 'edit' | 'view'

interface CoreStoreProps {
  pipelineId: string
  pipelineName: string
  topicCount: number // Primary: number of topics (1 or 2)
  operationsSelected: OperationsSelectedType // Computed/derived for backward compatibility
  pipelineVersion: string | undefined // Track the version of the pipeline config
  outboundEventPreview: OutboundEventPreviewType
  analyticsConsent: boolean
  consentAnswered: boolean
  isDirty: boolean
  apiConfig: Partial<Pipeline>
  // New mode-related fields
  mode: StoreMode
  baseConfig: Pipeline | undefined
  // New incremental state management fields
  lastSavedConfig: Pipeline | undefined
  saveHistory: Pipeline[]
}

interface CoreStore extends CoreStoreProps {
  // actions
  setApiConfig: (config: Partial<Pipeline>) => void
  setTopicCount: (topicCount: number) => void
  setOperationsSelected: (operations: OperationsSelectedType) => void // Kept for backward compatibility
  getComputedOperation: () => string // Computes operation from topicCount + deduplication + join
  setOutboundEventPreview: (preview: OutboundEventPreviewType) => void
  setAnalyticsConsent: (consent: boolean) => void
  setConsentAnswered: (consent: boolean) => void
  markAsDirty: () => void
  markAsClean: () => void
  setPipelineId: (id: string) => void
  setPipelineName: (name: string) => void
  resetPipelineState: (topicCount: number, force?: boolean) => void
  setPipelineVersion: (version: string | undefined) => void
  // New mode-related actions
  setMode: (mode: StoreMode) => void
  setBaseConfig: (config: Pipeline | undefined) => void
  hydrateFromConfig: (config: Pipeline) => Promise<void>
  resetToInitial: () => void
  discardChanges: () => void
  enterCreateMode: () => void
  enterEditMode: (config: Pipeline) => void
  enterViewMode: (config: Pipeline) => Promise<void>
  isDirtyComparedToBase: () => boolean
  // New incremental state management actions
  setLastSavedConfig: (config: Pipeline | undefined) => void
  addToSaveHistory: (config: Pipeline) => void
  getLastSavedConfig: () => Pipeline | undefined
  getSaveHistory: () => Pipeline[]
  clearSaveHistory: () => void
  discardToLastSaved: () => Promise<void>
  // New section-based hydration actions
  hydrateSection: (section: string, config: Pipeline) => Promise<void>
  discardSection: (section: string) => Promise<void>
  discardSections: (sections: string[]) => void
}

export interface CoreSlice {
  coreStore: CoreStore
}

export const initialCoreStore: CoreStoreProps = {
  pipelineId: '',
  pipelineName: '',
  topicCount: 0, // 0 = not set, 1 = single topic, 2 = two topics
  pipelineVersion: undefined,
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
    setTopicCount: (topicCount: number) => {
      set((state) => ({
        coreStore: { ...state.coreStore, topicCount },
      }))
      // Update operationsSelected for backward compatibility
      // Note: This is a simplified update - full operation computation happens in getComputedOperation
      const newState = get()
      const computedOp = newState.coreStore.getComputedOperation()
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          operationsSelected: {
            operation: computedOp,
          },
        },
      }))
    },
    setPipelineVersion: (version: string | undefined) =>
      set((state) => ({
        coreStore: { ...state.coreStore, pipelineVersion: version },
      })),
    setOperationsSelected: (operations: OperationsSelectedType) =>
      set((state) => ({
        coreStore: { ...state.coreStore, operationsSelected: operations },
      })),
    getComputedOperation: () => {
      const state = get()
      const topicCount = state.coreStore.topicCount

      // If topicCount is not set, return empty string
      if (!topicCount || topicCount < 1) {
        return ''
      }

      // Access other stores through the root store
      // We need to cast to access other slices since we're in a slice creator
      try {
        const rootState = get() as any
        const deduplicationConfigs = rootState.deduplicationStore?.deduplicationConfigs || {}
        const hasJoin = rootState.joinStore?.enabled || false

        // Convert deduplication configs to the format expected by computeOperationType
        const dedupConfigs: Record<number, { enabled: boolean; key: string }> = {}
        Object.keys(deduplicationConfigs).forEach((key) => {
          const index = parseInt(key, 10)
          const config = deduplicationConfigs[index]
          if (config) {
            dedupConfigs[index] = {
              enabled: config.enabled || false,
              key: config.key || '',
            }
          }
        })

        return computeOperationType(topicCount, dedupConfigs, hasJoin)
      } catch (error) {
        // If stores aren't initialized yet, return a basic operation based on topicCount
        console.warn('Failed to compute operation, using basic fallback:', error)
        return topicCount === 2 ? 'joining' : 'ingest-only'
      }
    },
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
    resetPipelineState: (topicCount: number, force = false) => {
      const state = get()
      const currentConfig = state.coreStore

      if (force || (currentConfig.isDirty && topicCount !== currentConfig.topicCount)) {
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            topicCount,
            outboundEventPreview: {
              events: [],
            },
            isDirty: false,
          },
        }))
        // Update computed operation
        const newState = get()
        const computedOp = newState.coreStore.getComputedOperation()
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            operationsSelected: {
              operation: computedOp,
            },
          },
        }))
      } else {
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            topicCount,
          },
        }))
        // Update computed operation
        const newState = get()
        const computedOp = newState.coreStore.getComputedOperation()
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            operationsSelected: {
              operation: computedOp,
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
    hydrateFromConfig: async (config: Pipeline) => {
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          pipelineId: config.pipeline_id,
          pipelineName: config.name,
          pipelineVersion: config.version, // Store the version from the config
          isDirty: false,
        },
      }))
      // Use the new hydrateSection method for consistency
      const currentState = get()
      await currentState.coreStore.hydrateSection('all', config)
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
            topicCount: 0,
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
      const currentState = get()
      const previousMode = currentState.coreStore.mode

      set((state) => ({
        coreStore: {
          ...state.coreStore,
          ...initialCoreStore,
          mode: 'create',
          baseConfig: undefined,
          lastSavedConfig: undefined,
          saveHistory: [],
          analyticsConsent: state.coreStore.analyticsConsent,
          consentAnswered: state.coreStore.consentAnswered,
        },
      }))

      // Track mode entry
      trackMode.createEntered({
        fromMode: previousMode,
        trigger: 'enterCreateMode',
        resetState: true,
      })
    },
    enterEditMode: (config: Pipeline) => {
      const operationType = determineOperationType(config)
      const topicCount = config?.source?.topics?.length || 0
      const currentState = get()
      const previousMode = currentState.coreStore.mode

      set((state) => ({
        coreStore: {
          ...state.coreStore,
          mode: 'edit',
          baseConfig: config,
          lastSavedConfig: config, // Initialize lastSavedConfig with the loaded config
          saveHistory: [config], // Initialize saveHistory with the loaded config
          topicCount: topicCount > 0 ? topicCount : 0,
          operationsSelected: {
            operation: operationType, // Computed for backward compatibility
          },
        },
      }))

      // Hydrate the store with the config
      const newState = get()
      newState.coreStore.hydrateFromConfig(config)

      // Track mode entry
      trackMode.editEntered({
        fromMode: previousMode,
        trigger: 'enterEditMode',
        pipelineId: config.pipeline_id,
        pipelineName: config.name,
        operationType,
        hasBaseConfig: true,
      })
    },
    enterViewMode: async (config: Pipeline) => {
      const operationType = determineOperationType(config)
      const topicCount = config?.source?.topics?.length || 0
      const currentState = get()
      const previousMode = currentState.coreStore.mode

      set((state) => ({
        coreStore: {
          ...state.coreStore,
          mode: 'view',
          baseConfig: config,
          lastSavedConfig: config, // Initialize lastSavedConfig with the loaded config
          saveHistory: [config], // Initialize saveHistory with the loaded config
          topicCount: topicCount > 0 ? topicCount : 0,
          operationsSelected: {
            operation: operationType, // Computed for backward compatibility
          },
        },
      }))

      // Hydrate the store with the config
      const newState = get()
      await newState.coreStore.hydrateFromConfig(config)

      // Track mode entry
      trackMode.viewEntered({
        fromMode: previousMode,
        trigger: 'enterViewMode',
        pipelineId: config.pipeline_id,
        pipelineName: config.name,
        hasBaseConfig: true,
        isReadOnly: true,
        operationType,
      })
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
    discardToLastSaved: async () => {
      const state = get()
      const { lastSavedConfig } = state.coreStore

      if (lastSavedConfig) {
        try {
          // Re-hydrate all slices from lastSavedConfig instead of baseConfig
          await state.coreStore.hydrateFromConfig(lastSavedConfig)
          set((state) => ({
            coreStore: { ...state.coreStore, isDirty: false },
          }))
        } catch (error) {
          console.error('Failed to discard to last saved config:', error)
          throw error
        }
      }
    },
    // New section-based hydration methods
    hydrateSection: async (section: string, config: Pipeline) => {
      try {
        switch (section) {
          case 'kafka':
            hydrateKafkaConnection(config)
            break
          case 'topics':
            await hydrateKafkaTopics(config)
            break
          case 'deduplication':
            // Topics and deduplication are closely related, so hydrate both
            await hydrateKafkaTopics(config)
            break
          case 'join':
            hydrateJoinConfiguration(config)
            break
          case 'filter':
            hydrateFilter(config)
            break
          case 'clickhouse-connection':
            hydrateClickhouseConnection(config)
            break
          case 'clickhouse-destination':
            await hydrateClickhouseDestination(config)
            break
          case 'all':
            // Hydrate sync sections first (including filter - doesn't need event schema)
            hydrateKafkaConnection(config)
            hydrateClickhouseConnection(config)
            hydrateJoinConfiguration(config)
            hydrateFilter(config)
            // Then async sections that require network calls
            await hydrateKafkaTopics(config)
            await hydrateClickhouseDestination(config)
            break
          default:
            console.warn(`Unknown section for hydration: ${section}`)
        }
      } catch (error) {
        console.error(`❌ Hydration failed for section '${section}':`, error)
        // Mark relevant stores as invalidated on hydration failure
        if (error instanceof Error && error.message.includes('Kafka')) {
          const { useStore } = await import('./index')
          const fullState = useStore.getState()
          fullState.kafkaStore.markAsInvalidated('hydration-failed')
          fullState.topicsStore.markAsInvalidated('hydration-failed')
        }
        throw error
      }
    },
    discardSection: async (section: string) => {
      const state = get()
      const { lastSavedConfig } = state.coreStore

      if (lastSavedConfig) {
        try {
          // Hydrate only the specific section from lastSavedConfig
          await state.coreStore.hydrateSection(section, lastSavedConfig)
        } catch (error) {
          console.error(`Failed to discard section '${section}':`, error)
          throw error
        }
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
      } else {
        console.warn('No lastSavedConfig available for sections discard')
      }
    },
  },
})
