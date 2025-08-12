import { StateCreator } from 'zustand'
import {
  ValidationState,
  ValidationMethods,
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
} from '@/src/types/validation'

export interface JoinStream {
  streamId: string
  topicName: string
  joinKey: string
  dataType: string
  joinTimeWindowValue: number
  joinTimeWindowUnit: string
  orientation: 'left' | 'right'
}

export interface JoinStoreProps {
  enabled: boolean
  type: string
  streams: JoinStream[]
  validation: ValidationState
}

export interface JoinStore extends JoinStoreProps, ValidationMethods {
  // actions
  setEnabled: (enabled: boolean) => void
  setType: (type: string) => void
  setStreams: (streams: JoinStream[]) => void
  getIsJoinDirty: () => boolean

  // reset join store
  resetJoinStore: () => void
}

export interface JoinSlice {
  joinStore: JoinStore
}

export const initialJoinStore: JoinStoreProps = {
  enabled: false,
  type: 'temporal',
  streams: [],
  validation: createInitialValidation(),
}

export const createJoinSlice: StateCreator<JoinSlice> = (set, get) => ({
  joinStore: {
    // state
    enabled: false,
    type: 'temporal',
    streams: [],
    validation: createInitialValidation(),

    // actions
    setEnabled: (enabled: boolean) => set((state) => ({ joinStore: { ...state.joinStore, enabled } })),
    setType: (type: string) => set((state) => ({ joinStore: { ...state.joinStore, type } })),
    setStreams: (streams: JoinStream[]) =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          streams: streams.map((stream) => ({
            topicName: stream.topicName,
            streamId: stream.streamId,
            joinKey: stream.joinKey,
            dataType: stream.dataType,
            joinTimeWindowValue: stream.joinTimeWindowValue,
            joinTimeWindowUnit: stream.joinTimeWindowUnit,
            orientation: stream.orientation,
          })),
          validation: createValidValidation(), // Auto-mark as valid when streams are set
        },
      })),
    getIsJoinDirty: () => {
      const { streams } = get().joinStore
      return streams.length > 0
    },

    // reset join store
    resetJoinStore: () => set((state) => ({ joinStore: { ...state.joinStore, ...initialJoinStore } })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
