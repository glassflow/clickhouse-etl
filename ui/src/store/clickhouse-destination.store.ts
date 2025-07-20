import { StateCreator } from 'zustand'

export interface ClickhouseDestinationProps {
  // destination configuration including mapping and other settings
  clickhouseDestination: {
    scheme: string
    database: string
    table: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
    // useSSL: boolean
  }
}

export const initialClickhouseDestinationStore: ClickhouseDestinationProps = {
  clickhouseDestination: {
    scheme: '',
    database: '',
    table: '',
    mapping: [],
    destinationColumns: [],
    maxBatchSize: 1000,
    maxDelayTime: 1,
    maxDelayTimeUnit: 'm',
  },
}

export interface ClickhouseDestinationStore extends ClickhouseDestinationProps {
  // actions
  setClickhouseDestination: (destination: {
    scheme: string
    database: string
    table: string
    mapping: any[]
    destinationColumns: any[]
    maxBatchSize: number
    maxDelayTime: number
    maxDelayTimeUnit: string
  }) => void
  resetDestinationState: () => void
  getIsDestinationMappingDirty: () => boolean
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
      destinationColumns: [],
      mapping: [],
      maxBatchSize: 1000,
      maxDelayTime: 1,
      maxDelayTimeUnit: 'm',
      useSSL: true,
    },

    // actions
    resetDestinationState: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseData: null,
          clickhouseDestination: {
            scheme: '',
            database: '',
            table: '',
            destinationColumns: [],
            mapping: [],
            maxBatchSize: 1000,
            maxDelayTime: 1,
            maxDelayTimeUnit: 'm',
          },
        },
      })),

    setClickhouseDestination: (destination: {
      scheme: string
      database: string
      table: string
      mapping: any[]
      destinationColumns: any[]
      maxBatchSize: number
      maxDelayTime: number
      maxDelayTimeUnit: string
      // useSSL: boolean
    }) =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseDestination: destination,
        },
      })),

    getIsDestinationMappingDirty: () => {
      const { mapping } = get().clickhouseDestinationStore.clickhouseDestination
      return mapping.some((value) => value !== '')
    },

    clearData: () =>
      set((state) => ({
        clickhouseDestinationStore: {
          ...state.clickhouseDestinationStore,
          clickhouseData: null,
        },
      })),

    // reset destination store
    resetDestinationStore: () =>
      set((state) => ({
        clickhouseDestinationStore: { ...state.clickhouseDestinationStore, ...initialClickhouseDestinationStore },
      })),
  },
})
