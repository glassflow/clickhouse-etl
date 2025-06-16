import { NextResponse } from 'next/server'
import {
  createClickHouseConnection,
  parseTabSeparated,
  closeConnection,
  type ClickHouseConfig,
} from '@/src/utils/clickhouse'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()

    const { database } = requestBody

    if (!database) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database name is required',
        },
        { status: 400 },
      )
    }

    const config: ClickHouseConfig = {
      host: requestBody.host,
      port: requestBody.port,
      nativePort: requestBody.nativePort,
      username: requestBody.username,
      password: requestBody.password,
      database,
      useSSL: requestBody.useSSL ?? true,
      secure: requestBody.secure,
      connectionType: requestBody.connectionType,
      proxyUrl: requestBody.proxyUrl,
      connectionString: requestBody.connectionString,
    }

    try {
      const connection = await createClickHouseConnection(config)

      if (connection.type === 'direct' && connection.directFetch) {
        // Direct HTTP approach for SSL connections
        const data = await connection.directFetch(`SHOW TABLES FROM ${database} FORMAT TabSeparated`)
        const tables = parseTabSeparated(data)

        return NextResponse.json({
          success: true,
          tables,
        })
      } else if (connection.type === 'client' && connection.client) {
        // ClickHouse client approach for HTTP connections
        const result = await connection.client.query({
          query: `SHOW TABLES FROM ${database}`,
          format: 'JSONEachRow',
        })

        const rows = (await result.json()) as { name: string }[]
        const tables = rows.map((row) => row.name)

        await closeConnection(connection)

        return NextResponse.json({
          success: true,
          tables,
        })
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : `Failed to fetch tables for database '${database}'`,
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
