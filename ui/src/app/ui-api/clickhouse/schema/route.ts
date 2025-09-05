import { NextResponse } from 'next/server'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { type ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

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
      httpPort: requestBody.httpPort,
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
    const clickhouseService = new ClickhouseService()
    const result = await clickhouseService.getTableSchema(config, database, table)
    return NextResponse.json(result)
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
