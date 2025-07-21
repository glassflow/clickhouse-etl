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
import { StateCreator } from 'zustand'

interface PipelineConfigStoreProps {
  pipelineId: string
  pipelineName: string
  operationsSelected: OperationsSelectedType
  outboundEventPreview: OutboundEventPreviewType
  analyticsConsent: boolean
  consentAnswered: boolean
  isDirty: boolean
  apiConfig: any
}

interface PipelineConfigStore extends PipelineConfigStoreProps {
  // actions
  setApiConfig: (config: any) => void
  setOperationsSelected: (operations: OperationsSelectedType) => void
  setOutboundEventPreview: (preview: OutboundEventPreviewType) => void
  setAnalyticsConsent: (consent: boolean) => void
  setConsentAnswered: (consent: boolean) => void
  markAsDirty: () => void
  markAsClean: () => void
  setPipelineId: (id: string) => void
  setPipelineName: (name: string) => void
  resetPipelineState: (operation: string, force?: boolean) => void
}

export interface PipelineConfigSlice {
  configStore: PipelineConfigStore
}

export const initialPipelineConfigStore: PipelineConfigStoreProps = {
  pipelineId: '',
  pipelineName: '',
  operationsSelected: {
    operation: '',
  },
  outboundEventPreview: {
    events: [],
  },
  analyticsConsent: false,
  consentAnswered: false,
  isDirty: false,
  apiConfig: {},
}

export const createPipelineConfigSlice: StateCreator<PipelineConfigSlice> = (set, get) => ({
  configStore: {
    ...initialPipelineConfigStore,
    setPipelineId: (id: string) =>
      set((state) => ({
        configStore: { ...state.configStore, pipelineId: id },
      })),
    setPipelineName: (name: string) =>
      set((state) => ({
        configStore: { ...state.configStore, pipelineName: name },
      })),
    setOperationsSelected: (operations: OperationsSelectedType) =>
      set((state) => ({
        configStore: { ...state.configStore, operationsSelected: operations },
      })),
    setAnalyticsConsent: (consent: boolean) =>
      set((state) => ({
        configStore: { ...state.configStore, analyticsConsent: consent },
      })),
    setConsentAnswered: (consent: boolean) =>
      set((state) => ({
        configStore: { ...state.configStore, consentAnswered: consent },
      })),
    setOutboundEventPreview: (preview: OutboundEventPreviewType) =>
      set((state) => ({
        configStore: { ...state.configStore, outboundEventPreview: preview },
      })),
    markAsDirty: () => {
      set((state) => ({
        configStore: { ...state.configStore, isDirty: true },
      }))
      Cookies.set('isDirty', 'true', { expires: 1 })
    },
    markAsClean: () => {
      set((state) => ({
        configStore: { ...state.configStore, isDirty: false },
      }))
      Cookies.set('isDirty', 'false', { expires: 1 })
    },
    setApiConfig: (config: any) =>
      set((state) => ({
        configStore: { ...state.configStore, apiConfig: config },
      })),
    resetPipelineState: (operation: string, force = false) => {
      const state = get()
      const currentConfig = state.configStore

      if (force || (currentConfig.isDirty && operation !== currentConfig.operationsSelected.operation)) {
        set((state) => ({
          configStore: {
            ...state.configStore,
            operationsSelected: {
              operation: operation,
            },
            outboundEventPreview: {
              events: [],
            },
            isDirty: false,
          },
        }))
      } else {
        set((state) => ({
          configStore: {
            ...state.configStore,
            operationsSelected: {
              operation: operation,
            },
          },
        }))
      }
    },
  },
})
