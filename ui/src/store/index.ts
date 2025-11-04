import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  OperationsSelectedType,
  DeduplicationConfigType,
  JoinConfigSchema,
  OutboundEventPreviewType,
} from '@/src/scheme'
import mockData from './mocks'
import { createKafkaSlice, KafkaSlice } from './kafka.store'
import { createClickhouseConnectionSlice, ClickhouseConnectionSlice } from './clickhouse-connection.store'
import { createClickhouseDestinationSlice, ClickhouseDestinationSlice } from './clickhouse-destination.store'
import { createStepsSlice, StepsSlice } from './steps.store'
import { createTopicsSlice, TopicsSlice } from './topics.store'
import { createDeduplicationSlice, DeduplicationSlice } from './deduplication.store'
import { createJoinSlice, JoinSlice } from './join.store'
import { createCoreSlice, CoreSlice, getTopicCountForOperation } from './core'
import Cookies from 'js-cookie'

interface Store
  extends KafkaSlice,
    ClickhouseConnectionSlice,
    ClickhouseDestinationSlice,
    StepsSlice,
    TopicsSlice,
    DeduplicationSlice,
    JoinSlice,
    CoreSlice {
  // Global reset function that can reset all slices
  resetAllPipelineState: (operation: string, force?: boolean) => void

  // Convenience methods for specific scenarios
  resetForNewPipeline: (operation: string) => void
  resetFormValidationStates: () => void
  clearAllUserData: () => void
}

// Wrap your store with devtools middleware
const useActualStore = create<Store>()(
  devtools(
    (set, get, store) => ({
      ...createKafkaSlice(set, get, store),
      ...createClickhouseConnectionSlice(set, get, store),
      ...createClickhouseDestinationSlice(set, get, store),
      ...createStepsSlice(set, get, store),
      ...createTopicsSlice(set, get, store),
      ...createDeduplicationSlice(set, get, store),
      ...createJoinSlice(set, get, store),
      ...createCoreSlice(set, get, store),

      // Global reset function that resets all slices
      resetAllPipelineState: (operation: string, force = false) => {
        const state = get()
        const currentConfig = state.coreStore
        const topicCount = getTopicCountForOperation(operation)

        if (force || (currentConfig.isDirty && operation !== currentConfig.operationsSelected.operation)) {
          // Complete reset: Use individual store reset methods for comprehensive cleanup
          // Reset individual stores using their dedicated reset methods
          state.kafkaStore.resetKafkaStore()
          state.topicsStore.resetTopicsStore()
          state.deduplicationStore.resetDeduplicationStore()
          state.joinStore.resetJoinStore()
          state.clickhouseConnectionStore.resetClickhouseStore()
          state.clickhouseDestinationStore.resetDestinationStore()
          state.stepsStore.resetStepsStore()

          // Reset core store with new operation
          state.coreStore.enterCreateMode()
          state.coreStore.setOperationsSelected({ operation })

          // Set correct topic count for the operation
          set((state) => ({
            topicsStore: {
              ...state.topicsStore,
              topicCount: topicCount,
            },
          }))
        } else {
          // Partial reset: Only change operation type
          set((state) => ({
            coreStore: {
              ...state.coreStore,
              operationsSelected: {
                operation: operation,
              },
            },
            topicsStore: {
              ...state.topicsStore,
              topicCount: topicCount,
            },
          }))
        }
      },

      // Convenience method: Reset specifically for new pipeline creation
      resetForNewPipeline: (operation: string) => {
        const state = get()

        // Always do a complete reset for new pipelines
        state.resetAllPipelineState(operation, true)

        // Additional cleanup specific to new pipeline creation
        Cookies.remove('isDirty')
        state.coreStore.clearSaveHistory()
      },

      // Convenience method: Reset only form validation states
      resetFormValidationStates: () => {
        const state = get()

        // Reset validation states without losing user data
        state.kafkaStore.resetValidation()
        state.topicsStore.resetValidation()
        state.deduplicationStore.resetValidation()
        state.joinStore.resetValidation()
        state.clickhouseConnectionStore.resetValidation()
        state.clickhouseDestinationStore.resetValidation()
      },

      // Convenience method: Clear all user data (nuclear option)
      clearAllUserData: () => {
        const state = get()

        // Reset all stores to initial state
        state.kafkaStore.resetKafkaStore()
        state.topicsStore.resetTopicsStore()
        state.deduplicationStore.resetDeduplicationStore()
        state.joinStore.resetJoinStore()
        state.clickhouseConnectionStore.resetClickhouseStore()
        state.clickhouseDestinationStore.resetDestinationStore()
        state.stepsStore.resetStepsStore()
        state.coreStore.enterCreateMode()

        // Clear cookies and local storage
        Cookies.remove('isDirty')
        state.coreStore.clearSaveHistory()
      },
    }),
    {
      name: 'app-clickhouse-pivot-store', // unique name for the store in DevTools
      enabled: process.env.NODE_ENV !== 'production', // only enable in development
      trace: process.env.NEXT_PUBLIC_REDUX_DEVTOOLS_TRACE === 'true', // enable stack traces for state changes
    },
  ),
)

const useStoreWithMocks = create<Store>()(
  devtools((set) => ({
    ...useActualStore.getState(),
    ...mockData,
  })),
)

export const useStore = useActualStore

// NOTE: uncomment this to use mocks in development
// export const useStore = process.env.NODE_ENV === 'production' ? useActualStore : useStoreWithMocks
