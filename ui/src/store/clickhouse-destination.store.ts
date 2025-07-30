import { StateCreator } from 'zustand'
import {
  ValidationState,
  ValidationMethods,
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
} from '@/src/types/validation'

export interface ClickhouseDestinationProps {
  // destination configuration including mapping and other settings
  clickhouseDestination: {
    scheme: string
    database: string
    table: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
    // useSSL: boolean
  }
  // validation state
  validation: ValidationState
}

export const initialClickhouseDestinationStore: ClickhouseDestinationProps = {
  clickhouseDestination: {
    scheme: '',
    database: '',
    table: '',
    mapping: [],
    destinationColumns: [],
    maxBatchSize: 1000,
    maxDelayTime: 1,
    maxDelayTimeUnit: 'm',
  },
  validation: createInitialValidation(),
}

export interface ClickhouseDestinationStore extends ClickhouseDestinationProps, ValidationMethods {
  // actions
  setClickhouseDestination: (destination: {
    scheme: string
    database: string
    table: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
  }) => void
  resetDestinationState: () => void
  getIsDestinationMappingDirty: () => boolean
}

export interface ClickhouseDestinationSlice {
  clickhouseDestinationStore: ClickhouseDestinationStore
}

export const createClickhouseDestinationSlice: StateCreator<ClickhouseDestinationSlice> = (set, get) => ({
  clickhouseDestinationStore: {
    // destination configuration including mapping and other settings
    clickhouseDestination: {
      scheme: '',
      database: '',
      table: '',
      destinationColumns: [],
      mapping: [],
      maxBatchSize: 1000,
      maxDelayTime: 1,
      maxDelayTimeUnit: 'm',
      useSSL: true,
    },
    // validation state
    validation: createInitialValidation(),

    // actions
    resetDestinationState: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: {
            scheme: '',
            database: '',
            table: '',
            destinationColumns: [],
            mapping: [],
            maxBatchSize: 1000,
            maxDelayTime: 1,
            maxDelayTimeUnit: 'm',
          },
        },
      })),

    setClickhouseDestination: (destination: {
      scheme: string
      database: string
      table: string
      mapping: any[]
      destinationColumns: any[]
      maxBatchSize: number
      maxDelayTime: number
      maxDelayTimeUnit: string
      // useSSL: boolean
    }) =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: destination,
          validation: createValidValidation(), // Auto-mark as valid when destination is set
        },
      })),

    getIsDestinationMappingDirty: () => {
      const { mapping } = get().clickhouseDestinationStore.clickhouseDestination
      return mapping.some((value) => value !== '')
    },

    // reset destination store
    resetDestinationStore: () =>
      set((state) => ({
        clickhouseDestinationStore: { ...state.clickhouseDestinationStore, ...initialClickhouseDestinationStore },
      })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
