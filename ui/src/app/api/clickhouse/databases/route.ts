import { NextResponse } from 'next/server'
import {
  createClickHouseConnection,
  parseTabSeparated,
  closeConnection,
  type ClickHouseConfig,
} from '@/src/app/api/clickhouse/clickhouse-utils'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()

    const config: ClickHouseConfig = {
      host: requestBody.host,
      port: requestBody.port,
      nativePort: requestBody.nativePort,
      username: requestBody.username,
      password: requestBody.password,
      useSSL: requestBody.useSSL ?? true,
      connectionType: requestBody.connectionType,
      proxyUrl: requestBody.proxyUrl,
      connectionString: requestBody.connectionString,
      skipCertificateVerification: requestBody.skipCertificateVerification ?? false,
    }

    try {
      const connection = await createClickHouseConnection(config)

      if (connection.type === 'direct' && connection.directFetch) {
        // Direct HTTP approach for SSL connections
        const data = await connection.directFetch('SHOW DATABASES FORMAT TabSeparated')
        const databases = parseTabSeparated(data)

        return NextResponse.json({
          success: true,
          databases,
          method: 'direct-http',
        })
      } else if (connection.type === 'client' && connection.client) {
        // ClickHouse client approach for HTTP connections
        const result = await connection.client.query({
          query: 'SHOW DATABASES',
          format: 'JSONEachRow',
        })

        const rows = (await result.json()) as { name: string }[]
        const databases = rows.map((row) => row.name)

        await closeConnection(connection)

        return NextResponse.json({
          success: true,
          databases,
        })
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch databases',
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 },
    )
  }
}
