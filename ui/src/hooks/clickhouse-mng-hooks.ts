import { useState } from 'react'
import { generateHost } from '@/src/utils/common.server'

interface ClickhouseConnectionConfig {
  host: string
  port: string
  username: string
  password: string
  database: string
  useSSL: boolean
  secure: boolean
  connectionType: 'direct' | 'proxy' | 'connectionString'
  proxyUrl?: string
  connectionString?: string
  table?: string
}

export function useClickhouseConnection() {
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([])
  const [availableTables, setAvailableTables] = useState<string[]>([])

  const testConnection = async (connectionConfig: ClickhouseConnectionConfig) => {
    setIsLoading(true)
    setConnectionStatus('idle')
    setConnectionError(null)

    try {
      // Make sure we're only sending serializable data
      const configToSend = {
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        database: connectionConfig.database,
        useSSL: connectionConfig.useSSL,
        secure: connectionConfig.secure,
        connectionType: connectionConfig.connectionType,
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

        if (data.databases && data.databases.length > 0) {
          setAvailableDatabases(data.databases)
        }

        return { success: true, databases: data.databases || [] }
      } else {
        setConnectionStatus('error')
        setConnectionError(data.error || 'Test connection failed - Failed to connect to ClickHouse')

        return { success: false, error: data.error || 'Test connection failed - Failed to connect to ClickHouse' }
      }
    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setConnectionError(errorMessage)

      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  const getDatabases = async (connectionConfig: ClickhouseConnectionConfig) => {
    if (!connectionConfig.host || !connectionConfig.port || !connectionConfig.username || !connectionConfig.password) {
      setConnectionError('Please fill in all fields')
      return { success: false, error: 'Please fill in all fields' }
    }

    // Don't modify the host here - send the original host value
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
  }

  const testDatabaseAccess = async (connectionConfig: ClickhouseConnectionConfig) => {
    if (!connectionConfig.database) {
      setConnectionError('Please select a database')
      return { success: false, error: 'Please select a database' }
    }

    setIsLoading(true)
    setConnectionStatus('idle')
    setConnectionError(null)

    try {
      // Make sure we're only sending serializable data
      const configToSend = {
        host: connectionConfig.host, // Don't use generateHost here - send raw host
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        database: connectionConfig.database,
        useSSL: connectionConfig.useSSL,
        secure: connectionConfig.secure,
        connectionType: connectionConfig.connectionType,
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
        if (data.tables && data.tables.length > 0) {
          setAvailableTables(data.tables)
        }
        return { success: true, tables: data.tables || [] }
      } else {
        setConnectionStatus('error')
        const errorMsg = data.error || `Failed to access database '${connectionConfig.database}'`
        setConnectionError(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setConnectionError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  const testTableAccess = async (connectionConfig: ClickhouseConnectionConfig) => {
    if (!connectionConfig.database || !connectionConfig.table) {
      setConnectionError('Please select both database and table')
      return { success: false, error: 'Please select both database and table' }
    }

    setIsLoading(true)
    setConnectionStatus('idle')
    setConnectionError(null)

    try {
      // Make sure we're only sending serializable data
      const configToSend = {
        host: connectionConfig.host, // Don't use generateHost here - send raw host
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        database: connectionConfig.database,
        table: connectionConfig.table,
        useSSL: connectionConfig.useSSL,
        secure: connectionConfig.secure,
        connectionType: connectionConfig.connectionType,
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
        return { success: true, sample: data.sample }
      } else {
        setConnectionStatus('error')
        const errorMsg =
          data.error || `Failed to access table '${connectionConfig.table}' in database '${connectionConfig.database}'`
        setConnectionError(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setConnectionError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    connectionStatus,
    connectionError,
    availableDatabases,
    availableTables,
    getDatabases,
    testConnection,
    testDatabaseAccess,
    testTableAccess,
  }
}
