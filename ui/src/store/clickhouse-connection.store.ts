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

export interface ClickhouseConnectionStoreProps {
  // connection configuration
  clickhouseConnection: ClickhouseConnectionFormType

  // Single source of truth for ClickHouse data
  clickhouseData: ClickHouseData | null
}

export interface ClickhouseConnectionStore extends ClickhouseConnectionStoreProps {
  // actions
  setClickhouseConnection: (connector: ClickhouseConnectionFormType) => void
  getIsClickhouseConnectionDirty: () => boolean

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

export interface ClickhouseConnectionSlice {
  clickhouseConnectionStore: ClickhouseConnectionStore
}

export const initialClickhouseConnectionStore: ClickhouseConnectionStoreProps = {
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
}

export const createClickhouseConnectionSlice: StateCreator<ClickhouseConnectionSlice> = (set, get) => ({
  clickhouseConnectionStore: {
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

    // actions
    setClickhouseConnection: (connector: ClickhouseConnectionFormType) =>
      set((state) => {
        // Check if connection details have changed
        const prevConnection = state.clickhouseConnectionStore.clickhouseConnection
        const isDifferentConnection =
          prevConnection.directConnection.host !== connector.directConnection.host ||
          prevConnection.directConnection.port !== connector.directConnection.port ||
          prevConnection.directConnection.username !== connector.directConnection.username ||
          prevConnection.directConnection.password !== connector.directConnection.password

        // If connection changed, reset related data
        if (isDifferentConnection) {
          return {
            clickhouseConnectionStore: {
              ...state.clickhouseConnectionStore,
              clickhouseConnection: connector,
              // Reset dependent data when connection changes
              clickhouseData: null,
            },
          }
        }

        // If just status change, only update connection
        return {
          clickhouseConnectionStore: {
            ...state.clickhouseConnectionStore,
            clickhouseConnection: connector,
          },
        }
      }),

    getIsClickhouseConnectionDirty: () => {
      const { directConnection, connectionStatus, connectionError } =
        get().clickhouseConnectionStore.clickhouseConnection
      return (
        Object.values(directConnection).some((value) => value !== '') ||
        connectionStatus !== 'idle' ||
        connectionError !== null
      )
    },

    // Data management actions
    updateDatabases: (databases: string[], connectionId: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases,
            tables: state.clickhouseConnectionStore.clickhouseData?.tables || {},
            tableSchemas: state.clickhouseConnectionStore.clickhouseData?.tableSchemas || {},
          },
        },
      })),

    updateTables: (database: string, tables: string[], connectionId: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseConnectionStore.clickhouseData?.databases || [],
            tables: {
              ...state.clickhouseConnectionStore.clickhouseData?.tables,
              [database]: tables,
            },
            tableSchemas: state.clickhouseConnectionStore.clickhouseData?.tableSchemas || {},
          },
        },
      })),

    updateTableSchema: (database: string, table: string, schema: any[], connectionId: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseData: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseConnectionStore.clickhouseData?.databases || [],
            tables: state.clickhouseConnectionStore.clickhouseData?.tables || {},
            tableSchemas: {
              ...state.clickhouseConnectionStore.clickhouseData?.tableSchemas,
              [`${database}:${table}`]: schema,
            },
          },
        },
      })),

    clearData: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseData: null,
        },
      })),

    // Getters for easy access
    getDatabases: () => {
      return get().clickhouseConnectionStore.clickhouseData?.databases || []
    },

    getTables: (database: string) => {
      return get().clickhouseConnectionStore.clickhouseData?.tables?.[database] || []
    },

    getTableSchema: (database: string, table: string) => {
      return get().clickhouseConnectionStore.clickhouseData?.tableSchemas?.[`${database}:${table}`] || []
    },

    getConnectionId: () => {
      return get().clickhouseConnectionStore.clickhouseData?.connectionId || null
    },

    // reset clickhouse store
    resetClickhouseStore: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          ...initialClickhouseConnectionStore,
        },
      })),
  },
})
