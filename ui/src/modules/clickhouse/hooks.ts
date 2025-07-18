import { useCallback, useState } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

// Unified ClickHouse connection hook that handles all connection-related operations
export const useClickhouseConnection = () => {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, setClickhouseConnection, updateDatabases } = clickhouseStore
  const analytics = useJourneyAnalytics()

  // Local state for connection management (replicating original behavior)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const testConnection = useCallback(
    async (connectionConfig: {
      host: string
      port: string
      username: string
      password: string
      database?: string
      nativePort?: string
      useSSL?: boolean
      skipCertificateVerification?: boolean
      connectionType?: 'direct' | 'proxy' | 'connectionString'
      proxyUrl?: string
      connectionString?: string
    }) => {
      setIsLoading(true)
      setConnectionStatus('idle')
      setConnectionError(null)

      try {
        // Make sure we're only sending serializable data (replicating original)
        const configToSend = {
          host: connectionConfig.host, // Don't transform host - send raw value
          port: connectionConfig.port,
          username: connectionConfig.username,
          password: connectionConfig.password,
          database: connectionConfig.database || '',
          useSSL: connectionConfig.useSSL ?? true,
          skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          connectionType: connectionConfig.connectionType || 'direct',
          proxyUrl: connectionConfig.proxyUrl,
          connectionString: connectionConfig.connectionString,
          testType: 'connection',
        }

        const response = await fetch('/api/clickhouse/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configToSend),
        })

        const data = await response.json()

        if (data.success) {
          setConnectionStatus('success')
          setConnectionError(null)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'success',
            connectionError: null,
          })

          // Update databases if provided
          if (data.databases && data.databases.length > 0) {
            const connectionId = `${connectionConfig.host}:${connectionConfig.port}`
            updateDatabases(data.databases, connectionId)
          }

          analytics.clickhouse.success({
            host: connectionConfig.host,
            databaseCount: data.databases?.length || 0,
          })

          return { success: true, databases: data.databases || [] }
        } else {
          setConnectionStatus('error')
          const errorMsg = data.error || 'Test connection failed - Failed to connect to ClickHouse'
          setConnectionError(errorMsg)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'error',
            connectionError: errorMsg,
          })

          analytics.clickhouse.failed({
            error: errorMsg,
            host: connectionConfig.host,
          })

          return { success: false, error: errorMsg }
        }
      } catch (error) {
        setConnectionStatus('error')
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        setConnectionError(errorMessage)

        // Update store connection status - only update status, don't spread connection
        setClickhouseConnection({
          connectionType: 'direct',
          directConnection: {
            host: connectionConfig.host,
            port: connectionConfig.port,
            username: connectionConfig.username,
            password: connectionConfig.password,
            nativePort: connectionConfig.nativePort ?? '',
            useSSL: connectionConfig.useSSL ?? true,
            skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          },
          connectionStatus: 'error',
          connectionError: errorMessage,
        })

        analytics.clickhouse.failed({
          error: errorMessage,
          host: connectionConfig.host,
        })

        return { success: false, error: errorMessage }
      } finally {
        setIsLoading(false)
      }
    },
    [setClickhouseConnection, updateDatabases, analytics],
  )

  const testDatabaseAccess = useCallback(
    async (connectionConfig: {
      host: string
      port: string
      username: string
      password: string
      database: string
      nativePort?: string
      useSSL?: boolean
      skipCertificateVerification?: boolean
      connectionType?: 'direct' | 'proxy' | 'connectionString'
      proxyUrl?: string
      connectionString?: string
    }) => {
      if (!connectionConfig.database) {
        setConnectionError('Please select a database')
        return { success: false, error: 'Please select a database' }
      }

      setIsLoading(true)
      setConnectionStatus('idle')
      setConnectionError(null)

      try {
        // Make sure we're only sending serializable data (replicating original)
        const configToSend = {
          host: connectionConfig.host, // Don't transform host - send raw value
          port: connectionConfig.port,
          username: connectionConfig.username,
          password: connectionConfig.password,
          database: connectionConfig.database,
          useSSL: connectionConfig.useSSL ?? true,
          skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          connectionType: connectionConfig.connectionType || 'direct',
          proxyUrl: connectionConfig.proxyUrl,
          connectionString: connectionConfig.connectionString,
          testType: 'database',
        }

        const response = await fetch('/api/clickhouse/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configToSend),
        })

        const data = await response.json()

        if (data.success) {
          setConnectionStatus('success')
          setConnectionError(null)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'success',
            connectionError: null,
          })

          analytics.destination.tablesFetched({
            database: connectionConfig.database,
            count: data.tables?.length || 0,
          })

          return { success: true, tables: data.tables || [] }
        } else {
          setConnectionStatus('error')
          const errorMsg = data.error || `Failed to access database '${connectionConfig.database}'`
          setConnectionError(errorMsg)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'error',
            connectionError: errorMsg,
          })

          analytics.destination.tableFetchedError({
            database: connectionConfig.database,
            error: errorMsg,
          })

          return { success: false, error: errorMsg }
        }
      } catch (error) {
        setConnectionStatus('error')
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        setConnectionError(errorMessage)

        // Update store connection status - only update status, don't spread connection
        setClickhouseConnection({
          connectionType: 'direct',
          directConnection: {
            host: connectionConfig.host,
            port: connectionConfig.port,
            username: connectionConfig.username,
            password: connectionConfig.password,
            nativePort: connectionConfig.nativePort ?? '',
            useSSL: connectionConfig.useSSL ?? true,
            skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          },
          connectionStatus: 'error',
          connectionError: errorMessage,
        })

        analytics.destination.tableFetchedError({
          database: connectionConfig.database,
          error: errorMessage,
        })

        return { success: false, error: errorMessage }
      } finally {
        setIsLoading(false)
      }
    },
    [setClickhouseConnection, analytics],
  )

  const testTableAccess = useCallback(
    async (connectionConfig: {
      host: string
      port: string
      username: string
      password: string
      database: string
      table: string
      nativePort?: string
      useSSL?: boolean
      skipCertificateVerification?: boolean
      connectionType?: 'direct' | 'proxy' | 'connectionString'
      proxyUrl?: string
      connectionString?: string
    }) => {
      if (!connectionConfig.database || !connectionConfig.table) {
        setConnectionError('Please select both database and table')
        return { success: false, error: 'Please select both database and table' }
      }

      setIsLoading(true)
      setConnectionStatus('idle')
      setConnectionError(null)

      try {
        // Make sure we're only sending serializable data (replicating original)
        const configToSend = {
          host: connectionConfig.host, // Don't transform host - send raw value
          port: connectionConfig.port,
          username: connectionConfig.username,
          password: connectionConfig.password,
          database: connectionConfig.database,
          table: connectionConfig.table,
          useSSL: connectionConfig.useSSL ?? true,
          skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          connectionType: connectionConfig.connectionType || 'direct',
          proxyUrl: connectionConfig.proxyUrl,
          connectionString: connectionConfig.connectionString,
          testType: 'table',
        }

        const response = await fetch('/api/clickhouse/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configToSend),
        })

        const data = await response.json()

        if (data.success) {
          setConnectionStatus('success')
          setConnectionError(null)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'success',
            connectionError: null,
          })

          analytics.destination.tableSelected({
            database: connectionConfig.database,
            table: connectionConfig.table,
          })

          return { success: true, sample: data.sample }
        } else {
          setConnectionStatus('error')
          const errorMsg =
            data.error ||
            `Failed to access table '${connectionConfig.table}' in database '${connectionConfig.database}'`
          setConnectionError(errorMsg)

          // Update store connection status - only update status, don't spread connection
          setClickhouseConnection({
            connectionType: 'direct',
            directConnection: {
              host: connectionConfig.host,
              port: connectionConfig.port,
              username: connectionConfig.username,
              password: connectionConfig.password,
              nativePort: connectionConfig.nativePort ?? '',
              useSSL: connectionConfig.useSSL ?? true,
              skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
            },
            connectionStatus: 'error',
            connectionError: errorMsg,
          })

          analytics.destination.tableFetchedError({
            database: connectionConfig.database,
            table: connectionConfig.table,
            error: errorMsg,
          })

          return { success: false, error: errorMsg }
        }
      } catch (error) {
        setConnectionStatus('error')
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        setConnectionError(errorMessage)

        // Update store connection status - only update status, don't spread connection
        setClickhouseConnection({
          connectionType: 'direct',
          directConnection: {
            host: connectionConfig.host,
            port: connectionConfig.port,
            username: connectionConfig.username,
            password: connectionConfig.password,
            nativePort: connectionConfig.nativePort ?? '',
            useSSL: connectionConfig.useSSL ?? true,
            skipCertificateVerification: connectionConfig.skipCertificateVerification ?? true,
          },
          connectionStatus: 'error',
          connectionError: errorMessage,
        })

        analytics.destination.tableFetchedError({
          database: connectionConfig.database,
          table: connectionConfig.table,
          error: errorMessage,
        })

        return { success: false, error: errorMessage }
      } finally {
        setIsLoading(false)
      }
    },
    [setClickhouseConnection, analytics],
  )

  const getDatabases = useCallback(
    async (connectionConfig: {
      host: string
      port: string
      username: string
      password: string
      database?: string
      useSSL?: boolean
      skipCertificateVerification?: boolean
      connectionType?: 'direct' | 'proxy' | 'connectionString'
      proxyUrl?: string
      connectionString?: string
    }) => {
      if (
        !connectionConfig.host ||
        !connectionConfig.port ||
        !connectionConfig.username ||
        !connectionConfig.password
      ) {
        setConnectionError('Please fill in all fields')
        return { success: false, error: 'Please fill in all fields' }
      }

      // Don't modify the host here - send the original host value (replicating original)
      const response = await fetch('/api/clickhouse/databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...connectionConfig,
          // Don't transform the host
        }),
      })

      const data = await response.json()

      return data
    },
    [],
  )

  return {
    isLoading,
    connectionStatus,
    connectionError,
    testConnection,
    testDatabaseAccess,
    testTableAccess,
    getDatabases,
  }
}

export const useClickhouseDatabases = () => {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, clickhouseData, updateDatabases, getDatabases, getConnectionId } = clickhouseStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchDatabases = useCallback(async () => {
    if (!clickhouseConnection.directConnection.host || !clickhouseConnection.directConnection.port) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const configToSend = {
        host: clickhouseConnection.directConnection.host,
        port: clickhouseConnection.directConnection.port,
        username: clickhouseConnection.directConnection.username,
        password: clickhouseConnection.directConnection.password,
        database: '',
        useSSL: clickhouseConnection.directConnection.useSSL,
        skipCertificateVerification: clickhouseConnection.directConnection.skipCertificateVerification,
        connectionType: 'direct' as const,
      }

      const response = await fetch('/api/clickhouse/databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const databases = data.databases || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}`
        updateDatabases(databases, connectionId)
        analytics.destination.databasesFetched({ count: databases.length })
      } else {
        throw new Error(data.error || 'Failed to fetch databases')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch databases'
      setError(errorMessage)
      analytics.destination.databaseFetchedError({ error: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }, [clickhouseConnection, updateDatabases, analytics])

  const databases = getDatabases()
  const connectionId = getConnectionId()

  return {
    databases,
    isLoading,
    error,
    fetchDatabases,
    hasData: !!clickhouseData,
    connectionId,
  }
}

export const useClickhouseTables = (database: string) => {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, clickhouseData, updateTables, getTables, getConnectionId } = clickhouseStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchTables = useCallback(async () => {
    if (!clickhouseConnection.directConnection.host || !clickhouseConnection.directConnection.port || !database) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const configToSend = {
        host: clickhouseConnection.directConnection.host,
        port: clickhouseConnection.directConnection.port,
        username: clickhouseConnection.directConnection.username,
        password: clickhouseConnection.directConnection.password,
        database,
        useSSL: clickhouseConnection.directConnection.useSSL,
        skipCertificateVerification: clickhouseConnection.directConnection.skipCertificateVerification,
        connectionType: 'direct' as const,
        nativePort: clickhouseConnection.directConnection.nativePort
          ? Number(clickhouseConnection.directConnection.nativePort)
          : undefined,
      }

      const response = await fetch('/api/clickhouse/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const tables = data.tables || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}`
        updateTables(database, tables, connectionId)
        analytics.destination.tablesFetched({ database, count: tables.length })
      } else {
        throw new Error(data.error || 'Failed to fetch tables')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tables'
      setError(errorMessage)
      analytics.destination.tableFetchedError({ database, error: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }, [clickhouseConnection, database, updateTables, analytics])

  const tables = getTables(database)
  const connectionId = getConnectionId()

  return {
    tables,
    isLoading,
    error,
    fetchTables,
    hasData: !!clickhouseData?.tables?.[database],
    connectionId,
  }
}

export const useClickhouseTableSchema = (database: string, table: string) => {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, clickhouseData, updateTableSchema, getTableSchema, getConnectionId } = clickhouseStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchTableSchema = useCallback(async () => {
    if (
      !clickhouseConnection.directConnection.host ||
      !clickhouseConnection.directConnection.port ||
      !database ||
      !table
    ) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const configToSend = {
        host: clickhouseConnection.directConnection.host,
        port: clickhouseConnection.directConnection.port,
        username: clickhouseConnection.directConnection.username,
        password: clickhouseConnection.directConnection.password,
        database,
        table,
        useSSL: clickhouseConnection.directConnection.useSSL,
        skipCertificateVerification: clickhouseConnection.directConnection.skipCertificateVerification,
        connectionType: 'direct' as const,
      }

      const response = await fetch('/api/clickhouse/schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const schema = data.columns || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}`
        updateTableSchema(database, table, schema, connectionId)
        analytics.destination.columnsShowed({ database, table, count: schema.length })
      } else {
        throw new Error(data.error || 'Failed to fetch table schema')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch table schema'
      setError(errorMessage)
      analytics.destination.tableFetchedError({ database, table, error: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }, [clickhouseConnection, database, table, updateTableSchema, analytics])

  const schema = getTableSchema(database, table)
  const connectionId = getConnectionId()

  return {
    schema,
    isLoading,
    error,
    fetchTableSchema,
    hasData: !!clickhouseData?.tableSchemas?.[`${database}:${table}`],
    connectionId,
  }
}
