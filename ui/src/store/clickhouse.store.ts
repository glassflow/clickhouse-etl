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
  resetDestinationState: () => void
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
        skipCertificateVerification: false,
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
      set((state) => {
        // Check if connection details have changed
        const prevConnection = state.clickhouseStore.clickhouseConnection
        const isDifferentConnection =
          prevConnection.directConnection.host !== connector.directConnection.host ||
          prevConnection.directConnection.port !== connector.directConnection.port ||
          prevConnection.directConnection.username !== connector.directConnection.username ||
          prevConnection.directConnection.password !== connector.directConnection.password

        // If connection changed, reset related data
        if (isDifferentConnection) {
          return {
            clickhouseStore: {
              ...state.clickhouseStore,
              clickhouseConnection: connector,
              // Reset dependent data when connection changes
              availableDatabases: [],
              clickhouseDestination: {
                ...state.clickhouseStore.clickhouseDestination,
                database: '',
                table: '',
                mapping: [],
                destinationColumns: [],
              },
            },
          }
        }

        // If just status change, only update connection
        return {
          clickhouseStore: {
            ...state.clickhouseStore,
            clickhouseConnection: connector,
          },
        }
      }),

    resetDestinationState: () =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          availableDatabases: [],
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
