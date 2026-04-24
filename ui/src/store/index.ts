import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
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
import { createFilterSlice, FilterSlice } from './filter.store'
import { createTransformationSlice, TransformationSlice } from './transformation.store'
import { createCoreSlice, CoreSlice } from './core'
import { createNotificationsSlice, NotificationsSlice } from './notifications.store'
import { createResourcesSlice, ResourcesSlice } from './resources.store'
import { createOtlpSlice, OtlpSlice } from './otlp.store'
import Cookies from 'js-cookie'

interface Store
  extends KafkaSlice,
    ClickhouseConnectionSlice,
    ClickhouseDestinationSlice,
    StepsSlice,
    TopicsSlice,
    DeduplicationSlice,
    JoinSlice,
    FilterSlice,
    TransformationSlice,
    CoreSlice,
    NotificationsSlice,
    ResourcesSlice,
    OtlpSlice {
  // Global reset function that can reset all slices
  resetAllPipelineState: (topicCount: number, force?: boolean) => void

  // Convenience methods for specific scenarios
  resetForNewPipeline: (topicCount: number) => void
  resetFormValidationStates: () => void
  clearAllUserData: () => void
}

// Wrap your store with devtools + subscribeWithSelector middleware
const useActualStore = create<Store>()(
  devtools(
    subscribeWithSelector(
    (set, get, store) => ({
      ...createKafkaSlice(set, get, store),
      ...createClickhouseConnectionSlice(set, get, store),
      ...createClickhouseDestinationSlice(set, get, store),
      ...createStepsSlice(set, get, store),
      ...createTopicsSlice(set, get, store),
      ...createDeduplicationSlice(set, get, store),
      ...createJoinSlice(set, get, store),
      ...createFilterSlice(set, get, store),
      ...createTransformationSlice(set, get, store),
      ...createCoreSlice(set, get, store),
      ...createNotificationsSlice(set, get, store),
      ...createResourcesSlice(set, get, store),
      ...createOtlpSlice(set, get, store),

      // Global reset function that resets all slices
      resetAllPipelineState: (topicCount: number, force = false) => {
        const state = get()
        const currentConfig = state.coreStore

        if (force || (currentConfig.isDirty && topicCount !== currentConfig.topicCount)) {
          // Complete reset: Use individual store reset methods for comprehensive cleanup
          // Reset individual stores using their dedicated reset methods
          state.kafkaStore.resetKafkaStore()
          state.topicsStore.resetTopicsStore()
          state.deduplicationStore.resetDeduplicationStore()
          state.joinStore.resetJoinStore()
          state.filterStore.resetFilterStore()
          state.transformationStore.resetTransformationStore()
          state.clickhouseConnectionStore.resetClickhouseStore()
          state.clickhouseDestinationStore.resetDestinationStore()
          state.stepsStore.resetStepsStore()
          state.resourcesStore.resetResources()
          state.otlpStore.resetOtlpStore()

          // Reset core store with new topic count
          state.coreStore.enterCreateMode()
          state.coreStore.setTopicCount(topicCount)

          // Set correct topic count in topics store
          set((state) => ({
            topicsStore: {
              ...state.topicsStore,
              topicCount: topicCount,
            },
          }))
        } else {
          // Partial reset: Only change topic count
          state.coreStore.setTopicCount(topicCount)
          set((state) => ({
            topicsStore: {
              ...state.topicsStore,
              topicCount: topicCount,
            },
          }))
        }
      },

      // Convenience method: Reset specifically for new pipeline creation
      resetForNewPipeline: (topicCount: number) => {
        const state = get()

        // Always do a complete reset for new pipelines
        state.resetAllPipelineState(topicCount, true)

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
        state.filterStore.resetValidation()
        state.transformationStore.resetValidation()
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
        state.filterStore.resetFilterStore()
        state.transformationStore.resetTransformationStore()
        state.clickhouseConnectionStore.resetClickhouseStore()
        state.clickhouseDestinationStore.resetDestinationStore()
        state.stepsStore.resetStepsStore()
        state.resourcesStore.resetResources()
        state.otlpStore.resetOtlpStore()
        state.coreStore.enterCreateMode()

        // Clear cookies and local storage
        Cookies.remove('isDirty')
        state.coreStore.clearSaveHistory()
      },
    }),
    ),
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

/** Full store state type — use this for service functions that receive the whole store snapshot */
export type RootStoreState = Store

// NOTE: uncomment this to use mocks in development
// export const useStore = process.env.NODE_ENV === 'production' ? useActualStore : useStoreWithMocks
