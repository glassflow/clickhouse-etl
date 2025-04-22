import { StateCreator } from 'zustand'
import { ClickhouseConnectionFormType } from '@/src/scheme'

export interface ClickhouseStore {
  // connection state
  clickhouseConnection: ClickhouseConnectionFormType
  availableDatabases: string[]

  // destination state
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

  // actions
  setAvailableDatabases: (databases: string[]) => void
  setClickhouseConnection: (connector: ClickhouseConnectionFormType) => void
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
  getIsClickhouseConnectionDirty: () => boolean
  getClickhouseMappingDirty: () => boolean
}

export interface ClickhouseSlice {
  clickhouseStore: ClickhouseStore
}

export const createClickhouseSlice: StateCreator<ClickhouseSlice> = (set, get) => ({
  clickhouseStore: {
    // connection state
    clickhouseConnection: {
      connectionType: 'direct',
      directConnection: {
        host: '',
        port: '',
        username: '',
        password: '',
        nativePort: '',
        useSSL: true,
      },
      connectionStatus: 'idle',
      connectionError: null,
    },
    availableDatabases: [],

    // destination state
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
    setAvailableDatabases: (databases: string[]) =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          availableDatabases: databases,
        },
      })),

    setClickhouseConnection: (connector: ClickhouseConnectionFormType) =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseConnection: connector,
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
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseDestination: destination,
        },
      })),

    getIsClickhouseConnectionDirty: () => {
      const { directConnection, connectionStatus, connectionError } = get().clickhouseStore.clickhouseConnection
      return (
        Object.values(directConnection).some((value) => value !== '') ||
        connectionStatus !== 'idle' ||
        connectionError !== null
      )
    },
    getClickhouseMappingDirty: () => {
      const { mapping } = get().clickhouseStore.clickhouseDestination
      return mapping.some((value) => value !== '')
    },
  },
})
