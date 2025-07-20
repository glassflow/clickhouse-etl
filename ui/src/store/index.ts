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
import { createJoinSlice, JoinSlice } from './join.store'
import Cookies from 'js-cookie'

interface BaseStoreProps {
  pipelineId: string
  pipelineName: string
  operationsSelected: OperationsSelectedType
  outboundEventPreview: OutboundEventPreviewType
  analyticsConsent: boolean
  consentAnswered: boolean
  isDirty: boolean
  apiConfig: any
}

interface Store
  extends BaseStoreProps,
    KafkaSlice,
    ClickhouseConnectionSlice,
    ClickhouseDestinationSlice,
    StepsSlice,
    TopicsSlice,
    JoinSlice {
  // actions
  setApiConfig: (config: any) => void
  setOperationsSelected: (operations: OperationsSelectedType) => void
  setOutboundEventPreview: (preview: OutboundEventPreviewType) => void
  setAnalyticsConsent: (consent: boolean) => void
  setConsentAnswered: (consent: boolean) => void
  markAsDirty: () => void
  markAsClean: () => void
  resetPipelineState: (operation: string, force?: boolean) => void
  setPipelineId: (id: string) => void
  setPipelineName: (name: string) => void
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
      ...createJoinSlice(set, get, store),
      pipelineId: '',
      setPipelineId: (id: string) => set({ pipelineId: id }, false, 'setPipelineId'),

      pipelineName: '',
      setPipelineName: (name: string) => set({ pipelineName: name }, false, 'setPipelineName'),

      operationsSelected: {
        operation: '', // we can select only one operation - deduplication, joining, deduplication & joining
      },
      setOperationsSelected: (operations: OperationsSelectedType) =>
        set({ operationsSelected: operations }, false, 'setOperationsSelected'),

      analyticsConsent: false,
      setAnalyticsConsent: (consent: boolean) => set({ analyticsConsent: consent }, false, 'setAnalyticsConsent'),

      consentAnswered: false,
      setConsentAnswered: (consent: boolean) => set({ consentAnswered: consent }, false, 'setConsentAnswered'),

      outboundEventPreview: {
        events: [],
      },
      setOutboundEventPreview: (preview: OutboundEventPreviewType) =>
        set({ outboundEventPreview: preview }, false, 'setOutboundEventPreview'),

      isDirty: false,
      markAsDirty: () => {
        set({ isDirty: true })
        Cookies.set('isDirty', 'true', { expires: 1 })
      },
      markAsClean: () => {
        set({ isDirty: false })
        Cookies.set('isDirty', 'false', { expires: 1 })
      },

      apiConfig: {},
      setApiConfig: (config: any) => set({ apiConfig: config }, false, 'setApiConfig'),

      // reset pipeline state
      resetPipelineState: (operation: string, force = false) => {
        const state = get()

        if (force || (state.isDirty && operation !== state.operationsSelected.operation)) {
          set((state) => ({
            topicsStore: {
              ...state.topicsStore,
              topics: {},
              topicCount: 0,
              eventCache: {},
              availableTopics: state.topicsStore.availableTopics,
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
            operationsSelected: {
              operation: operation,
            },
            outboundEventPreview: {
              events: [],
            },
            isDirty: false,
          }))
        } else {
          set({
            operationsSelected: {
              operation: operation,
            },
          })
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
