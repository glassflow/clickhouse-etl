import { NextResponse } from 'next/server'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { type ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

interface AddColumnOperation {
  op: 'add'
  name: string
  type: string
  nullable?: boolean
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()
    const { database, table, operations } = requestBody
    if (!database || !table) {
      return NextResponse.json(
        { success: false, error: 'Database and table names are required' },
        { status: 400 },
      )
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one operation is required' },
        { status: 400 },
      )
    }
    const addOps = operations.filter((o: AddColumnOperation) => o.op === 'add') as AddColumnOperation[]
    if (addOps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Only ADD COLUMN operations are supported' },
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
    const result = await clickhouseService.alterTable(config, {
      database,
      table,
      operations: addOps.map((o) => ({
        op: 'add' as const,
        name: String(o.name ?? ''),
        type: String(o.type ?? 'String'),
        nullable: o.nullable !== false,
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
