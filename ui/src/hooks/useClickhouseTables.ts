import { useCallback, useState } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export const useClickhouseTables = (database: string) => {
  const { clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const { clickhouseConnection, clickhouseMetadata, updateTables, getTables, getConnectionId } =
    clickhouseConnectionStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchTables = useCallback(async () => {
    if (!clickhouseConnection.directConnection.host || !clickhouseConnection.directConnection.httpPort || !database) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const configToSend = {
        host: clickhouseConnection.directConnection.host,
        httpPort: clickhouseConnection.directConnection.httpPort,
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

      const response = await fetch('/ui-api/clickhouse/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const tables = data.tables || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.httpPort}`
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
    hasData: !!clickhouseMetadata?.tables?.[database],
    connectionId,
  }
}
