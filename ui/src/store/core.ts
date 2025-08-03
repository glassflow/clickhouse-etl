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
          pipelineId: config.id,
          pipelineName: config.name,
          isDirty: false,
        },
      }))
      hydrateKafkaConnection(config)
      hydrateKafkaTopics(config)
      hydrateClickhouseConnection(config)
      hydrateClickhouseDestination(config)
      hydrateJoinConfiguration(config)
    },
    resetToInitial: () => {
      const state = get()
      const { baseConfig } = state.coreStore

      if (baseConfig) {
        // Re-hydrate from baseConfig
        set((state) => ({
          coreStore: {
            ...state.coreStore,
            pipelineId: baseConfig.id,
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
        },
      }))
    },
    enterEditMode: (config: Pipeline) => {
      set((state) => ({
        coreStore: {
          ...state.coreStore,
          mode: 'edit',
          baseConfig: config,
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
      return pipelineId !== baseConfig.id || pipelineName !== baseConfig.name
    },
  },
})
