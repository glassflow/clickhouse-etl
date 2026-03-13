import { StateCreator } from 'zustand'
import {
  ValidationState,
  ValidationMethods,
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
} from '@/src/types/validation'
import type { DestinationPath } from '@/src/modules/clickhouse/types'

export interface ClickhouseDestinationState {
  scheme: string
  database: string
  table: string
  mapping: any[]
  destinationColumns: any[]
  maxBatchSize: number
  maxDelayTime: number
  maxDelayTimeUnit: string
  destinationPath: DestinationPath
  tableName?: string
  engine?: string
  orderBy?: string
}

export interface ClickhouseDestinationProps {
  clickhouseDestination: ClickhouseDestinationState
  validation: ValidationState
}

const defaultDestinationState: ClickhouseDestinationState = {
  scheme: '',
  database: '',
  table: '',
  mapping: [],
  destinationColumns: [],
  maxBatchSize: 1000,
  maxDelayTime: 1,
  maxDelayTimeUnit: 'm',
  destinationPath: 'create',
}

export const initialClickhouseDestinationStore: ClickhouseDestinationProps = {
  clickhouseDestination: { ...defaultDestinationState },
  validation: createInitialValidation(),
}

export interface ClickhouseDestinationStore extends ClickhouseDestinationProps, ValidationMethods {
  setClickhouseDestination: (destination: ClickhouseDestinationState) => void
  /**
   * Updates the clickhouse destination with partial data without changing validation state.
   */
  updateClickhouseDestinationDraft: (partial: Partial<ClickhouseDestinationState>) => void
  /**
   * Sets destination path (create | existing). Resets only path-specific fields; batch settings are preserved.
   */
  setDestinationPath: (path: DestinationPath) => void
  resetDestinationState: () => void
  getIsDestinationMappingDirty: () => boolean
  resetDestinationStore: () => void
}

export interface ClickhouseDestinationSlice {
  clickhouseDestinationStore: ClickhouseDestinationStore
}

function getPathSpecificReset(
  current: ClickhouseDestinationState,
  newPath: DestinationPath,
): Partial<ClickhouseDestinationState> {
  if (newPath === 'create') {
    return {
      destinationPath: 'create',
      table: '',
      tableName: undefined,
      engine: undefined,
      orderBy: undefined,
      mapping: [],
      destinationColumns: [],
    }
  }
  return {
    destinationPath: 'existing',
    tableName: undefined,
    engine: undefined,
    orderBy: undefined,
    mapping: [],
    destinationColumns: [],
  }
}

export const createClickhouseDestinationSlice: StateCreator<ClickhouseDestinationSlice> = (set, get) => ({
  clickhouseDestinationStore: {
    clickhouseDestination: { ...defaultDestinationState },
    validation: createInitialValidation(),

    resetDestinationState: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: { ...defaultDestinationState },
        },
      })),

    setClickhouseDestination: (destination: ClickhouseDestinationState) =>
      set((state) => {
        const current = state.clickhouseDestinationStore.clickhouseDestination
        const merged: ClickhouseDestinationState = {
          ...defaultDestinationState,
          ...current,
          ...destination,
        }
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            clickhouseDestination: merged,
            validation: createValidValidation(),
          },
        }
      }),

    updateClickhouseDestinationDraft: (partial: Partial<ClickhouseDestinationState>) =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: {
            ...state.clickhouseDestinationStore.clickhouseDestination,
            ...partial,
          },
        },
      })),

    setDestinationPath: (path: DestinationPath) =>
      set((state) => {
        const current = state.clickhouseDestinationStore.clickhouseDestination
        const reset = getPathSpecificReset(current, path)
        const next = { ...current, ...reset }
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            clickhouseDestination: next,
          },
        }
      }),

    getIsDestinationMappingDirty: () => {
      const { mapping } = get().clickhouseDestinationStore.clickhouseDestination
      return mapping.some((value) => value !== '')
    },

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
