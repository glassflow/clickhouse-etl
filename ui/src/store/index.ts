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
import { createTopicSelectionDraftSlice, TopicSelectionDraftSlice } from './topic-selection-draft.store'
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
    TopicSelectionDraftSlice,
    JoinSlice,
    CoreSlice {
  // Global reset function that can reset all slices
  resetAllPipelineState: (operation: string, force?: boolean) => void
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
      ...createTopicSelectionDraftSlice(set, get, store),
      ...createJoinSlice(set, get, store),
      ...createCoreSlice(set, get, store),

      // Global reset function that resets all slices
      resetAllPipelineState: (operation: string, force = false) => {
        const state = get()
        const currentConfig = state.coreStore
        const topicCount = getTopicCountForOperation(operation)

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
            topicsStore: {
              ...state.topicsStore,
              topics: {},
              topicCount: topicCount,
              availableTopics: state.topicsStore.availableTopics,
            },
            deduplicationStore: {
              ...state.deduplicationStore,
              deduplicationConfigs: {},
            },
            joinStore: {
              ...state.joinStore,
              enabled: false,
              type: 'temporal',
              streams: [],
            },
            clickhouseDestination: {
              scheme: '',
              database: '',
              table: '',
              destinationColumns: [],
              mapping: [],
            },
            activeStep: 'kafka-connection',
            completedSteps: ['kafka-connection'],
          }))
        } else {
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
    }),
    {
      name: 'app-clickhouse-pivot-store', // unique name for the store in DevTools
      enabled: process.env.NODE_ENV !== 'production', // only enable in development
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
