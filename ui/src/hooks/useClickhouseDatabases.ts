import { useCallback, useState } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export const useClickhouseDatabases = () => {
  const { clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const { clickhouseConnection, clickhouseMetadata, updateDatabases, getDatabases, getConnectionId } =
    clickhouseConnectionStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchDatabases = useCallback(async () => {
    if (!clickhouseConnection.directConnection.host || !clickhouseConnection.directConnection.httpPort) {
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
        database: '',
        useSSL: clickhouseConnection.directConnection.useSSL,
        skipCertificateVerification: clickhouseConnection.directConnection.skipCertificateVerification,
        connectionType: 'direct' as const,
      }

      const response = await fetch('/ui-api/clickhouse/databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const databases = data.databases || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.httpPort}`
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
    hasData: !!clickhouseMetadata,
    connectionId,
  }
}
