import { useCallback, useState } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { notify } from '@/src/notifications'
import { clickhouseMessages } from '@/src/notifications/messages'

export const useClickhouseTableSchema = (database: string, table: string) => {
  const { clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const { clickhouseConnection, clickhouseMetadata, updateTableSchema, getTableSchema, getConnectionId } =
    clickhouseConnectionStore
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analytics = useJourneyAnalytics()

  const fetchTableSchema = useCallback(async () => {
    if (
      !clickhouseConnection.directConnection.host ||
      !clickhouseConnection.directConnection.httpPort ||
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
        httpPort: clickhouseConnection.directConnection.httpPort,
        username: clickhouseConnection.directConnection.username,
        password: clickhouseConnection.directConnection.password,
        database,
        table,
        useSSL: clickhouseConnection.directConnection.useSSL,
        skipCertificateVerification: clickhouseConnection.directConnection.skipCertificateVerification,
        connectionType: 'direct' as const,
      }

      const response = await fetch('/ui-api/clickhouse/schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      })

      const data = await response.json()

      if (data.success) {
        const schema = data.columns || []
        const connectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.httpPort}`
        updateTableSchema(database, table, schema, connectionId)
        analytics.destination.columnsShowed({ database, table, count: schema.length })
      } else {
        throw new Error(data.error || 'Failed to fetch table schema')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch table schema'
      setError(errorMessage)

      // Show notification to user
      notify(
        clickhouseMessages.fetchSchemaFailed(database, table, () => {
          fetchTableSchema() // Retry
        }),
      )

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
    hasData: !!clickhouseMetadata?.tableSchemas?.[`${database}:${table}`],
    connectionId,
  }
}
