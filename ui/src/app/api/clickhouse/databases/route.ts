import { NextResponse } from 'next/server'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { type ClickHouseConfig } from '@/src/app/api/clickhouse/clickhouse-utils'

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
    const clickhouseService = new ClickhouseService()
    const result = await clickhouseService.getDatabases(config)
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
