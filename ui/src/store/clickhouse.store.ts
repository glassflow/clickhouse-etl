import { StateCreator } from 'zustand'
import { ClickhouseConnectionFormType } from '@/src/scheme'

// ClickHouse data structure - single source of truth
interface ClickHouseData {
  lastFetched: number
  connectionId: string
  databases?: string[]
  tables?: Record<string, string[]> // database -> tables mapping
  tableSchemas?: Record<string, any[]> // "database:table" -> schema mapping
}

export interface ClickhouseStoreProps {
  // connection configuration
  clickhouseConnection: ClickhouseConnectionFormType

  // Single source of truth for ClickHouse data
  clickhouseData: ClickHouseData | null

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

export interface ClickhouseStore extends ClickhouseStoreProps {
  // actions
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

  // Data management actions
  updateDatabases: (databases: string[], connectionId: string) => void
  updateTables: (database: string, tables: string[], connectionId: string) => void
  updateTableSchema: (database: string, table: string, schema: any[], connectionId: string) => void
  clearData: () => void

  // Getters for easy access - derived data
  getDatabases: () => string[]
  getTables: (database: string) => string[]
  getTableSchema: (database: string, table: string) => any[]
  getConnectionId: () => string | null
}

export interface ClickhouseSlice {
  clickhouseStore: ClickhouseStore
}

export const initialClickhouseStore: ClickhouseStoreProps = {
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
  clickhouseData: null,
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

export const createClickhouseSlice: StateCreator<ClickhouseSlice> = (set, get) => ({
  clickhouseStore: {
    // connection configuration
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

    // Single source of truth for ClickHouse data
    clickhouseData: null,

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
              clickhouseData: null,
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

    // Data management actions
    updateDatabases: (databases: string[], connectionId: string) =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases,
            tables: state.clickhouseStore.clickhouseData?.tables || {},
            tableSchemas: state.clickhouseStore.clickhouseData?.tableSchemas || {},
          },
        },
      })),

    updateTables: (database: string, tables: string[], connectionId: string) =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseStore.clickhouseData?.databases || [],
            tables: {
              ...state.clickhouseStore.clickhouseData?.tables,
              [database]: tables,
            },
            tableSchemas: state.clickhouseStore.clickhouseData?.tableSchemas || {},
          },
        },
      })),

    updateTableSchema: (database: string, table: string, schema: any[], connectionId: string) =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseStore.clickhouseData?.databases || [],
            tables: state.clickhouseStore.clickhouseData?.tables || {},
            tableSchemas: {
              ...state.clickhouseStore.clickhouseData?.tableSchemas,
              [`${database}:${table}`]: schema,
            },
          },
        },
      })),

    clearData: () =>
      set((state) => ({
        clickhouseStore: {
          ...state.clickhouseStore,
          clickhouseData: null,
        },
      })),

    // Getters for easy access
    getDatabases: () => {
      return get().clickhouseStore.clickhouseData?.databases || []
    },

    getTables: (database: string) => {
      return get().clickhouseStore.clickhouseData?.tables?.[database] || []
    },

    getTableSchema: (database: string, table: string) => {
      return get().clickhouseStore.clickhouseData?.tableSchemas?.[`${database}:${table}`] || []
    },

    getConnectionId: () => {
      return get().clickhouseStore.clickhouseData?.connectionId || null
    },

    // reset clickhouse store
    resetClickhouseStore: () =>
      set((state) => ({ clickhouseStore: { ...state.clickhouseStore, ...initialClickhouseStore } })),
  },
})
