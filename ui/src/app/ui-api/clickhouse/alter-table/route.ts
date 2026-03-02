import { NextResponse } from 'next/server'
import {
  createClickHouseConnection,
  closeConnection,
  buildAlterTableQueries,
  type ClickHouseConfig,
} from '@/src/app/ui-api/clickhouse/clickhouse-utils'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const {
      host,
      httpPort,
      nativePort,
      username,
      password,
      database,
      table,
      operations,
      useSSL,
      skipCertificateVerification,
    } = body

    if (!database || !table || !Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'database, table, and operations (non-empty array) are required',
        },
        { status: 400 },
      )
    }

    const config: ClickHouseConfig = {
      host: host || body.host,
      httpPort: Number(httpPort ?? body.http_port ?? 8443),
      nativePort: nativePort != null ? Number(nativePort) : undefined,
      username: username || body.username,
      password: password || body.password,
      database,
      useSSL: useSSL ?? body.secure ?? true,
      skipCertificateVerification: skipCertificateVerification ?? body.skip_certificate_verification ?? false,
    }

    const connection = await createClickHouseConnection(config)
    const queries = buildAlterTableQueries(database, table, operations)

    try {
      for (const query of queries) {
        if (connection.type === 'direct' && connection.directFetch) {
          await connection.directFetch(query)
        } else if (connection.type === 'client' && connection.client) {
          await connection.client.exec({
            query,
            clickhouse_settings: { wait_end_of_query: 1 },
          })
        } else {
          throw new Error('Invalid connection type')
        }
      }
    } finally {
      await closeConnection(connection)
    }

    return NextResponse.json({
      success: true,
      message: `Table ${database}.${table} altered successfully`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
