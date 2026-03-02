import { StateCreator } from 'zustand'
import {
  ValidationState,
  ValidationMethods,
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
} from '@/src/types/validation'

export type DestinationPath = 'create_new' | 'use_existing'

export interface ClickhouseDestinationProps {
  // destination configuration including mapping and other settings
  clickhouseDestination: {
    scheme: string
    database: string
    table: string
    /** Path: create new table vs use existing table. Default create_new. */
    destinationPath: DestinationPath
    /** For create_new path: name of the table to create. */
    tableName: string
    /** For create_new path: ClickHouse table engine (e.g. MergeTree). */
    engine: string
    /** For create_new path: column name for ORDER BY. */
    orderBy: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
    // useSSL: boolean
  }
  /** Last saved destination (for draft discard). Used in standalone edit mode. */
  lastSavedDestination: null | {
    database: string
    table: string
    mapping: any[]
    destinationColumns: any[]
    tableName?: string
    engine?: string
    orderBy?: string
  }
  // validation state
  validation: ValidationState
}

export const initialClickhouseDestinationStore: ClickhouseDestinationProps = {
  clickhouseDestination: {
    scheme: '',
    database: '',
    table: '',
    destinationPath: 'create_new',
    tableName: '',
    engine: '',
    orderBy: '',
    mapping: [],
    destinationColumns: [],
    maxBatchSize: 1000,
    maxDelayTime: 1,
    maxDelayTimeUnit: 'm',
  },
  lastSavedDestination: null,
  validation: createInitialValidation(),
}

export interface ClickhouseDestinationStore extends ClickhouseDestinationProps, ValidationMethods {
  // actions
  setClickhouseDestination: (destination: {
    scheme: string
    database: string
    table: string
    destinationPath?: DestinationPath
    tableName?: string
    engine?: string
    orderBy?: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
  }) => void
  /**
   * Updates the clickhouse destination with partial data without changing validation state.
   * Use this for persisting in-progress form state (e.g., when user selects database/table)
   * so that the state can be restored when navigating back to the step.
   * The step will only be marked as valid when the user clicks "Continue" and
   * setClickhouseDestination is called.
   */
  updateClickhouseDestinationDraft: (
    partial: Partial<{
      scheme: string
      database: string
      table: string
      destinationPath: DestinationPath
      tableName: string
      engine: string
      orderBy: string
      mapping: any[]
      destinationColumns: any[]
      maxBatchSize: number
      maxDelayTime: number
      maxDelayTimeUnit: string
    }>,
  ) => void
  /** Set destination path; resets only path-specific fields, preserves batch settings. */
  setDestinationPath: (path: DestinationPath) => void
  /** Save current destination as lastSavedDestination (for discard draft). */
  saveDestinationSnapshot: () => void
  /** Revert to lastSavedDestination (discard draft). No ALTER or API calls. */
  discardDraft: () => void
  /** True if current destination differs from lastSavedDestination. */
  hasDraftChanges: () => boolean
  resetDestinationState: () => void
  getIsDestinationMappingDirty: () => boolean
  resetDestinationStore: () => void
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
      destinationPath: 'create_new',
      tableName: '',
      engine: '',
      orderBy: '',
      destinationColumns: [],
      mapping: [],
      maxBatchSize: 1000,
      maxDelayTime: 1,
      maxDelayTimeUnit: 'm',
      useSSL: true,
    },
    lastSavedDestination: null,
    // validation state
    validation: createInitialValidation(),

    // actions
    resetDestinationState: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: {
            ...state.clickhouseDestinationStore.clickhouseDestination,
            scheme: '',
            database: '',
            table: '',
            destinationPath: 'create_new',
            tableName: '',
            engine: '',
            orderBy: '',
            destinationColumns: [],
            mapping: [],
            maxBatchSize: state.clickhouseDestinationStore.clickhouseDestination.maxBatchSize,
            maxDelayTime: state.clickhouseDestinationStore.clickhouseDestination.maxDelayTime,
            maxDelayTimeUnit: state.clickhouseDestinationStore.clickhouseDestination.maxDelayTimeUnit,
          },
        },
      })),

    setClickhouseDestination: (destination: {
      scheme: string
      database: string
      table: string
      destinationPath?: DestinationPath
      tableName?: string
      engine?: string
      orderBy?: string
      mapping: any[]
      destinationColumns: any[]
      maxBatchSize: number
      maxDelayTime: number
      maxDelayTimeUnit: string
    }) =>
      set((state) => {
        const prev = state.clickhouseDestinationStore.clickhouseDestination
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            clickhouseDestination: {
              scheme: destination.scheme,
              database: destination.database,
              table: destination.table,
              destinationPath: destination.destinationPath ?? prev.destinationPath,
              tableName: destination.tableName ?? prev.tableName,
              engine: destination.engine ?? prev.engine,
              orderBy: destination.orderBy ?? prev.orderBy,
              mapping: destination.mapping,
              destinationColumns: destination.destinationColumns,
              maxBatchSize: destination.maxBatchSize,
              maxDelayTime: destination.maxDelayTime,
              maxDelayTimeUnit: destination.maxDelayTimeUnit,
            },
            validation: createValidValidation(),
          },
        }
      }),

    setDestinationPath: (path: DestinationPath) =>
      set((state) => {
        const prev = state.clickhouseDestinationStore.clickhouseDestination
        const batch = { maxBatchSize: prev.maxBatchSize, maxDelayTime: prev.maxDelayTime, maxDelayTimeUnit: prev.maxDelayTimeUnit }
        if (path === 'create_new') {
          return {
            clickhouseDestinationStore: {
              ...state.clickhouseDestinationStore,
              clickhouseDestination: {
                ...prev,
                destinationPath: 'create_new',
                table: '',
                tableName: '',
                engine: '',
                orderBy: '',
                mapping: [],
                destinationColumns: [],
                ...batch,
              },
            },
          }
        }
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            clickhouseDestination: {
              ...prev,
              destinationPath: 'use_existing',
              tableName: '',
              engine: '',
              orderBy: '',
              table: '',
              mapping: [],
              destinationColumns: [],
              ...batch,
            },
          },
        }
      }),

    saveDestinationSnapshot: () =>
      set((state) => {
        const d = state.clickhouseDestinationStore.clickhouseDestination
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            lastSavedDestination: {
              database: d.database,
              table: d.table,
              mapping: JSON.parse(JSON.stringify(d.mapping)),
              destinationColumns: JSON.parse(JSON.stringify(d.destinationColumns)),
              tableName: d.tableName,
              engine: d.engine,
              orderBy: d.orderBy,
            },
          },
        }
      }),

    discardDraft: () =>
      set((state) => {
        const saved = state.clickhouseDestinationStore.lastSavedDestination
        if (!saved) return state
        const d = state.clickhouseDestinationStore.clickhouseDestination
        return {
          clickhouseDestinationStore: {
            ...state.clickhouseDestinationStore,
            clickhouseDestination: {
              ...d,
              database: saved.database,
              table: saved.table,
              mapping: JSON.parse(JSON.stringify(saved.mapping)),
              destinationColumns: JSON.parse(JSON.stringify(saved.destinationColumns)),
              tableName: saved.tableName ?? '',
              engine: saved.engine ?? '',
              orderBy: saved.orderBy ?? '',
            },
          },
        }
      }),

    hasDraftChanges: () => {
      const state = get()
      const saved = state.clickhouseDestinationStore.lastSavedDestination
      if (!saved) return false
      const d = state.clickhouseDestinationStore.clickhouseDestination
      return (
        d.database !== saved.database ||
        d.table !== saved.table ||
        d.tableName !== (saved.tableName ?? '') ||
        d.engine !== (saved.engine ?? '') ||
        d.orderBy !== (saved.orderBy ?? '') ||
        JSON.stringify(d.mapping) !== JSON.stringify(saved.mapping) ||
        JSON.stringify(d.destinationColumns) !== JSON.stringify(saved.destinationColumns)
      )
    },

    updateClickhouseDestinationDraft: (
      partial: Partial<{
        scheme: string
        database: string
        table: string
        mapping: any[]
        destinationColumns: any[]
        maxBatchSize: number
        maxDelayTime: number
        maxDelayTimeUnit: string
      }>,
    ) =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: {
            ...state.clickhouseDestinationStore.clickhouseDestination,
            ...partial,
          },
          // NOTE: validation state is intentionally NOT changed here.
          // This allows in-progress form state to be persisted for restoration
          // when navigating back to the step, while keeping the step as "not valid"
          // until the user completes the step via "Continue".
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
