import type { AlterTableAddOperation } from '@/src/modules/clickhouse/utils'

export interface AlterTableConnectionConfig {
  host: string
  httpPort: string | number
  nativePort?: string | number
  username?: string
  password?: string
  useSSL?: boolean
  skipCertificateVerification?: boolean
}

export interface AlterTableParams {
  database: string
  table: string
  operations: AlterTableAddOperation[]
}

/**
 * Calls the UI-API alter-table endpoint to add new columns to an existing ClickHouse table.
 */
export async function alterTable(
  connectionConfig: AlterTableConnectionConfig,
  params: AlterTableParams
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/ui-api/clickhouse/alter-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: connectionConfig.host,
      httpPort: Number(connectionConfig.httpPort) || 8123,
      nativePort: connectionConfig.nativePort
        ? Number(connectionConfig.nativePort)
        : undefined,
      username: connectionConfig.username ?? '',
      password: connectionConfig.password ?? '',
      useSSL: connectionConfig.useSSL ?? true,
      skipCertificateVerification: connectionConfig.skipCertificateVerification ?? false,
      database: params.database,
      table: params.table,
      operations: params.operations,
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    return {
      success: false,
      error: data.error ?? `HTTP ${response.status}`,
    }
  }
  return data
}
