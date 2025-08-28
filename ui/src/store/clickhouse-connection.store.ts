import { StateCreator } from 'zustand'
import { ClickhouseConnectionFormType } from '@/src/scheme'
import {
  ValidationState,
  ValidationMethods,
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
} from '@/src/types/validation'

// ClickHouse data structure - single source of truth
interface ClickHouseMetadata {
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
  clickhouseMetadata: ClickHouseMetadata | null

  // validation state
  validation: ValidationState
}

export interface ClickhouseConnectionStore extends ClickhouseConnectionStoreProps, ValidationMethods {
  // actions
  setClickhouseConnection: (connector: ClickhouseConnectionFormType) => void
  getIsClickhouseConnectionDirty: () => boolean

  // Data management actions
  updateDatabases: (databases: string[], connectionId: string) => void
  updateTables: (database: string, tables: string[], connectionId: string) => void
  updateTableSchema: (database: string, table: string, schema: any[], connectionId: string) => void
  clearMetadata: () => void

  // Getters for easy access - derived data
  getDatabases: () => string[]
  getTables: (database: string) => string[]
  getTableSchema: (database: string, table: string) => any[]
  getConnectionId: () => string | null
  resetClickhouseStore: () => void
}

export interface ClickhouseConnectionSlice {
  clickhouseConnectionStore: ClickhouseConnectionStore
}

export const initialClickhouseConnectionStore: ClickhouseConnectionStoreProps = {
  clickhouseConnection: {
    connectionType: 'direct',
    directConnection: {
      host: '',
      httpPort: '',
      username: '',
      password: '',
      nativePort: '',
      useSSL: true,
      skipCertificateVerification: false,
    },
    connectionStatus: 'idle',
    connectionError: null,
  },
  clickhouseMetadata: null,
  validation: createInitialValidation(),
}

export const createClickhouseConnectionSlice: StateCreator<ClickhouseConnectionSlice> = (set, get) => ({
  clickhouseConnectionStore: {
    // connection configuration
    clickhouseConnection: {
      connectionType: 'direct',
      directConnection: {
        host: '',
        httpPort: '',
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
    clickhouseMetadata: null,

    // validation state
    validation: createInitialValidation(),

    // actions
    setClickhouseConnection: (connector: ClickhouseConnectionFormType) =>
      set((state) => {
        // Check if connection details have changed
        const prevConnection = state.clickhouseConnectionStore.clickhouseConnection
        const isDifferentConnection =
          prevConnection.directConnection.host !== connector.directConnection.host ||
          prevConnection.directConnection.httpPort !== connector.directConnection.httpPort ||
          prevConnection.directConnection.username !== connector.directConnection.username ||
          prevConnection.directConnection.password !== connector.directConnection.password

        // If connection changed, reset related data
        if (isDifferentConnection) {
          return {
            clickhouseConnectionStore: {
              ...state.clickhouseConnectionStore,
              clickhouseConnection: connector,
              // Reset dependent data when connection changes
              clickhouseMetadata: null,
              // Mark as valid when connection is set
              validation:
                connector.connectionStatus === 'success'
                  ? createValidValidation()
                  : state.clickhouseConnectionStore.validation,
            },
          }
        }

        // If just status change, only update connection
        return {
          clickhouseConnectionStore: {
            ...state.clickhouseConnectionStore,
            clickhouseConnection: connector,
            // Mark as valid when connection is successfully established
            validation:
              connector.connectionStatus === 'success'
                ? createValidValidation()
                : state.clickhouseConnectionStore.validation,
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
          clickhouseMetadata: {
            lastFetched: Date.now(),
            connectionId,
            databases,
            tables: state.clickhouseConnectionStore.clickhouseMetadata?.tables || {},
            tableSchemas: state.clickhouseConnectionStore.clickhouseMetadata?.tableSchemas || {},
          },
        },
      })),

    updateTables: (database: string, tables: string[], connectionId: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseMetadata: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseConnectionStore.clickhouseMetadata?.databases || [],
            tables: {
              ...state.clickhouseConnectionStore.clickhouseMetadata?.tables,
              [database]: tables,
            },
            tableSchemas: state.clickhouseConnectionStore.clickhouseMetadata?.tableSchemas || {},
          },
        },
      })),

    updateTableSchema: (database: string, table: string, schema: any[], connectionId: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseMetadata: {
            lastFetched: Date.now(),
            connectionId,
            databases: state.clickhouseConnectionStore.clickhouseMetadata?.databases || [],
            tables: state.clickhouseConnectionStore.clickhouseMetadata?.tables || {},
            tableSchemas: {
              ...state.clickhouseConnectionStore.clickhouseMetadata?.tableSchemas,
              [`${database}:${table}`]: schema,
            },
          },
        },
      })),

    clearMetadata: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          clickhouseMetadata: null,
        },
      })),

    // Getters for easy access
    getDatabases: () => {
      return get().clickhouseConnectionStore.clickhouseMetadata?.databases || []
    },

    getTables: (database: string) => {
      return get().clickhouseConnectionStore.clickhouseMetadata?.tables?.[database] || []
    },

    getTableSchema: (database: string, table: string) => {
      return get().clickhouseConnectionStore.clickhouseMetadata?.tableSchemas?.[`${database}:${table}`] || []
    },

    getConnectionId: () => {
      return get().clickhouseConnectionStore.clickhouseMetadata?.connectionId || null
    },

    // reset clickhouse store
    resetClickhouseStore: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          ...initialClickhouseConnectionStore,
        },
      })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        clickhouseConnectionStore: {
          ...state.clickhouseConnectionStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
