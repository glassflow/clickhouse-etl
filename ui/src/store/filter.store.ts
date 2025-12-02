import { StateCreator } from 'zustand'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

// Filter operator types based on expr-lang supported operations
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith'

// A single filter condition in the visual builder
export interface FilterCondition {
  id: string
  field: string // Field name from schema
  fieldType: string // Field type from schema (string, int, float64, bool, etc.)
  operator: FilterOperator
  value: string | number | boolean
}

// Filter configuration state
export interface FilterConfig {
  enabled: boolean
  combinator: 'and' | 'or' // How conditions are combined
  conditions: FilterCondition[]
}

export interface FilterStoreProps {
  filterConfig: FilterConfig
  // Generated expression string (for display and backend)
  expressionString: string
  // Backend validation state
  backendValidation: {
    status: 'idle' | 'validating' | 'valid' | 'invalid'
    error?: string
  }
  // Validation state
  validation: ValidationState
}

export interface FilterStore extends FilterStoreProps, ValidationMethods {
  // Actions
  setFilterEnabled: (enabled: boolean) => void
  setCombinator: (combinator: 'and' | 'or') => void
  addCondition: (condition: FilterCondition) => void
  updateCondition: (id: string, condition: Partial<FilterCondition>) => void
  removeCondition: (id: string) => void
  clearConditions: () => void
  setExpressionString: (expression: string) => void
  setBackendValidation: (status: FilterStoreProps['backendValidation']) => void
  getFilterConfig: () => FilterConfig
  skipFilter: () => void
  resetFilterStore: () => void
}

export interface FilterSlice {
  filterStore: FilterStore
}

const initialFilterConfig: FilterConfig = {
  enabled: false,
  combinator: 'and',
  conditions: [],
}

const initialBackendValidation: FilterStoreProps['backendValidation'] = {
  status: 'idle',
}

export const createFilterSlice: StateCreator<FilterSlice> = (set, get) => ({
  filterStore: {
    // State
    filterConfig: { ...initialFilterConfig },
    expressionString: '',
    backendValidation: { ...initialBackendValidation },
    validation: createInitialValidation(),

    // Actions
    setFilterEnabled: (enabled: boolean) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            enabled,
          },
        },
      })),

    setCombinator: (combinator: 'and' | 'or') =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            combinator,
          },
        },
      })),

    addCondition: (condition: FilterCondition) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            enabled: true,
            conditions: [...state.filterStore.filterConfig.conditions, condition],
          },
          validation: createValidValidation(),
        },
      })),

    updateCondition: (id: string, updates: Partial<FilterCondition>) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            conditions: state.filterStore.filterConfig.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
          },
          validation: createValidValidation(),
        },
      })),

    removeCondition: (id: string) =>
      set((state) => {
        const newConditions = state.filterStore.filterConfig.conditions.filter((c) => c.id !== id)
        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              conditions: newConditions,
              enabled: newConditions.length > 0,
            },
            validation: createValidValidation(),
          },
        }
      }),

    clearConditions: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            conditions: [],
            enabled: false,
          },
          expressionString: '',
          backendValidation: { status: 'idle' },
        },
      })),

    setExpressionString: (expression: string) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          expressionString: expression,
        },
      })),

    setBackendValidation: (backendValidation: FilterStoreProps['backendValidation']) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          backendValidation,
        },
      })),

    getFilterConfig: () => get().filterStore.filterConfig,

    skipFilter: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: { ...initialFilterConfig },
          expressionString: '',
          backendValidation: { status: 'idle' },
          validation: createValidValidation(), // Skipping is a valid choice
        },
      })),

    resetFilterStore: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: { ...initialFilterConfig },
          expressionString: '',
          backendValidation: { ...initialBackendValidation },
          validation: createInitialValidation(),
        },
      })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
