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
import { createClickhouseSlice, ClickhouseSlice } from './clickhouse.store'
import { createStepsSlice, StepsSlice } from './steps.store'
import { createTopicsSlice, TopicsSlice } from './topics.store'
import { createJoinSlice, JoinSlice } from './join.store'
import Cookies from 'js-cookie'

interface Store extends KafkaSlice, ClickhouseSlice, StepsSlice, TopicsSlice, JoinSlice {
  pipelineId: string
  pipelineName: string
  operationsSelected: OperationsSelectedType
  deduplicationConfig: DeduplicationConfigType
  outboundEventPreview: OutboundEventPreviewType
  analyticsConsent: boolean
  consentAnswered: boolean
  isDirty: boolean
  apiConfig: any
  setApiConfig: (config: any) => void
  setOperationsSelected: (operations: OperationsSelectedType) => void
  setDeduplicationConfig: (config: DeduplicationConfigType) => void
  setOutboundEventPreview: (preview: OutboundEventPreviewType) => void
  setAnalyticsConsent: (consent: boolean) => void
  setConsentAnswered: (consent: boolean) => void
  markAsDirty: () => void
  markAsClean: () => void
  resetPipelineState: (operation: string, force?: boolean) => void
  setPipelineId: (id: string) => void
}

// Wrap your store with devtools middleware
const useActualStore = create<Store>()(
  devtools(
    (set, get, store) => ({
      ...createKafkaSlice(set, get, store),
      ...createClickhouseSlice(set, get, store),
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
      consentAnswered: false,
      setConsentAnswered: (consent: boolean) => set({ consentAnswered: consent }, false, 'setConsentAnswered'),
      setAnalyticsConsent: (consent: boolean) => set({ analyticsConsent: consent }, false, 'setAnalyticsConsent'),
      deduplicationConfig: {},
      setDeduplicationConfig: (config: DeduplicationConfigType) =>
        set({ deduplicationConfig: config }, false, 'setDeduplicationConfig'),
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
            deduplicationConfig: {},
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
