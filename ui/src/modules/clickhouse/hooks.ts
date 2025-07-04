import { useCallback, useState } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export const useClickhouseConnection = () => {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, setClickhouseConnection } = clickhouseStore
  const analytics = useJourneyAnalytics()

  const testConnection = useCallback(async () => {
    if (!clickhouseConnection.directConnection.host || !clickhouseConnection.directConnection.port) {
      return
    }

    setClickhouseConnection({
      ...clickhouseConnection,
      connectionStatus: 'loading',
      connectionError: null,
    })

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
        setClickhouseConnection({
          ...clickhouseConnection,
          connectionStatus: 'success',
          connectionError: null,
        })
        analytics.clickhouse.success({
          host: clickhouseConnection.directConnection.host,
          databaseCount: data.databases?.length || 0,
        })
      } else {
        setClickhouseConnection({
          ...clickhouseConnection,
          connectionStatus: 'error',
          connectionError: data.error || 'Unknown error',
        })
        analytics.clickhouse.failed({
          error: data.error || 'Unknown error',
          host: clickhouseConnection.directConnection.host,
        })
      }
    } catch (error) {
      setClickhouseConnection({
        ...clickhouseConnection,
        connectionStatus: 'error',
        connectionError: error instanceof Error ? error.message : 'Unknown error',
      })
      analytics.clickhouse.failed({
        error: error instanceof Error ? error.message : 'Unknown error',
        host: clickhouseConnection.directConnection.host,
      })
    }
  }, [clickhouseConnection, setClickhouseConnection, analytics])

  return {
    connection: clickhouseConnection,
    testConnection,
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
