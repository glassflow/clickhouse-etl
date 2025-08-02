import { StateCreator } from 'zustand'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

// Types for deduplication configuration
export interface DeduplicationConfig {
  enabled: boolean
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  key: string
  keyType: string
}

export interface DeduplicationStoreProps {
  // Deduplication configurations indexed by topic index
  deduplicationConfigs: Record<number, DeduplicationConfig>

  // Validation state
  validation: ValidationState
}

export interface DeduplicationStore extends DeduplicationStoreProps, ValidationMethods {
  // Actions
  updateDeduplication: (topicIndex: number, config: DeduplicationConfig) => void
  getDeduplication: (topicIndex: number) => DeduplicationConfig | undefined
  invalidateDeduplication: (topicIndex: number) => void
  resetDeduplicationStore: () => void
}

export interface DeduplicationSlice {
  deduplicationStore: DeduplicationStore
}

export const createDeduplicationSlice: StateCreator<DeduplicationSlice> = (set, get) => ({
  deduplicationStore: {
    // State
    deduplicationConfigs: {},
    validation: createInitialValidation(),

    // Actions
    updateDeduplication: (topicIndex: number, config: DeduplicationConfig) =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          deduplicationConfigs: {
            ...state.deduplicationStore.deduplicationConfigs,
            [topicIndex]: config,
          },
          validation: createValidValidation(), // Auto-mark as valid when deduplication is updated
        },
      })),

    getDeduplication: (topicIndex: number) => get().deduplicationStore.deduplicationConfigs[topicIndex],

    invalidateDeduplication: (topicIndex: number) =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          deduplicationConfigs: {
            ...state.deduplicationStore.deduplicationConfigs,
            [topicIndex]: {
              enabled: true,
              window: 1,
              unit: 'minutes',
              key: '',
              keyType: '',
            },
          },
          validation: createInvalidatedValidation('topic-changed'),
        },
      })),

    resetDeduplicationStore: () =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          deduplicationConfigs: {},
          validation: createInitialValidation(),
        },
      })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        deduplicationStore: {
          ...state.deduplicationStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
