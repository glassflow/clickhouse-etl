import { NextResponse } from 'next/server'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { type ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

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
    const result = await clickhouseService.getTables(config, database)
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
