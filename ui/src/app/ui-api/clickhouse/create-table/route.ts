import { NextResponse } from 'next/server'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { type ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()
    const { database, table, engine, orderBy, columns } = requestBody
    if (!database || !table) {
      return NextResponse.json(
        { success: false, error: 'Database and table names are required' },
        { status: 400 },
      )
    }
    if (!engine || !orderBy) {
      return NextResponse.json(
        { success: false, error: 'Engine and orderBy are required' },
        { status: 400 },
      )
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one column is required' },
        { status: 400 },
      )
    }
    const config: ClickHouseConfig = {
      host: requestBody.host,
      httpPort: Number(requestBody.httpPort) || 8123,
      nativePort: requestBody.nativePort ? Number(requestBody.nativePort) : undefined,
      username: requestBody.username ?? '',
      password: requestBody.password ?? '',
      database,
      useSSL: requestBody.useSSL ?? true,
      connectionType: requestBody.connectionType,
      proxyUrl: requestBody.proxyUrl,
      connectionString: requestBody.connectionString,
      skipCertificateVerification: requestBody.skipCertificateVerification ?? false,
    }
    const clickhouseService = new ClickhouseService()
    const result = await clickhouseService.createTable(config, {
      database,
      table,
      engine: String(engine),
      orderBy: String(orderBy),
      columns: columns.map((c: { name?: string; type?: string }) => ({
        name: String(c?.name ?? ''),
        type: String(c?.type ?? 'String'),
      })),
    })
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
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
