import { NextResponse } from 'next/server'
import {
  createClickHouseConnection,
  parseJSONEachRow,
  closeConnection,
  buildSchemaQuery,
  buildFallbackSchemaQuery,
  type ClickHouseConfig,
} from '@/src/utils/clickhouse'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()

    const { database, table } = requestBody

    if (!database || !table) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database and table names are required',
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

      connectionType: requestBody.connectionType,
      proxyUrl: requestBody.proxyUrl,
      connectionString: requestBody.connectionString,
      skipCertificateVerification: requestBody.skipCertificateVerification ?? false,
    }

    try {
      const connection = await createClickHouseConnection(config)

      if (connection.type === 'direct' && connection.directFetch) {
        // Direct HTTP approach for SSL connections
        try {
          const query = buildSchemaQuery(database, table)
          const data = await connection.directFetch(query)
          const columns = parseJSONEachRow(data)

          return NextResponse.json({
            success: true,
            columns,
          })
        } catch (error) {
          // Try fallback query for regular tables
          if (database !== 'information_schema' && database !== 'system') {
            try {
              const fallbackQuery = buildFallbackSchemaQuery(database, table)
              const data = await connection.directFetch(fallbackQuery)
              const columns = parseJSONEachRow(data)

              return NextResponse.json({
                success: true,
                columns,
              })
            } catch (fallbackError) {
              throw fallbackError
            }
          }
          throw error
        }
      } else if (connection.type === 'client' && connection.client) {
        // ClickHouse client approach for HTTP connections
        const result = await connection.client.query({
          query: `DESCRIBE TABLE ${database}.${table}`,
          format: 'JSONEachRow',
        })

        const columns = await result.json()

        await closeConnection(connection)

        return NextResponse.json({
          success: true,
          columns,
        })
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Failed to fetch schema for table '${table}' in database '${database}'`,
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
