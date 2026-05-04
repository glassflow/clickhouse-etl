import { StateCreator } from 'zustand'
import { SourceType } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType, type OtlpSchemaField } from '@/src/modules/otlp/constants'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

export interface OtlpDeduplicationConfig {
  enabled: boolean
  key: string
  time_window: string
}

export interface OtlpStoreProps {
  signalType: SourceType | null
  sourceId: string
  deduplication: OtlpDeduplicationConfig
  schemaFields: OtlpSchemaField[]
  validation: ValidationState
}

export interface OtlpStore extends OtlpStoreProps, ValidationMethods {
  setSignalType: (type: SourceType) => void
  setSourceId: (id: string) => void
  setDeduplication: (config: Partial<OtlpDeduplicationConfig>) => void
  skipDeduplication: () => void
  resetOtlpStore: () => void
}

export interface OtlpSlice {
  otlpStore: OtlpStore
}

const initialDeduplication: OtlpDeduplicationConfig = {
  enabled: false,
  key: '',
  time_window: '5m',
}

export const initialOtlpStore: OtlpStoreProps = {
  signalType: null,
  sourceId: '',
  deduplication: { ...initialDeduplication },
  schemaFields: [],
  validation: createInitialValidation(),
}

export const createOtlpSlice: StateCreator<OtlpSlice> = (set, get) => ({
  otlpStore: {
    ...initialOtlpStore,

    setSignalType: (type: SourceType) =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          signalType: type,
          schemaFields: getOtlpFieldsForSignalType(type),
          deduplication: { ...initialDeduplication },
          validation: createInitialValidation(),
        },
      })),

    setSourceId: (id: string) =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, sourceId: id },
      })),

    setDeduplication: (config: Partial<OtlpDeduplicationConfig>) =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          deduplication: { ...state.otlpStore.deduplication, ...config },
        },
      })),

    skipDeduplication: () =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          deduplication: { ...initialDeduplication },
          validation: createValidValidation(),
        },
      })),

    resetOtlpStore: () =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          ...initialOtlpStore,
        },
      })),

    markAsValid: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createValidValidation() },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInvalidatedValidation(invalidatedBy) },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInitialValidation() },
      })),

    resetValidation: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInitialValidation() },
      })),
  },
})
