import { NextResponse } from 'next/server'
import { buildRegistryAuthHeaders } from '../_auth'
import { structuredLogger } from '@/src/observability'

const typeMap: Record<string, string> = {
  integer: 'int',
  number: 'float',
  boolean: 'bool',
  string: 'string',
  array: 'array',
  object: 'bytes',
  null: 'string',
}

function mapType(jsonSchemaType: string | string[] | undefined): string {
  if (Array.isArray(jsonSchemaType)) {
    const nonNull = jsonSchemaType.find((t) => t !== 'null')
    return nonNull ? (typeMap[nonNull] ?? 'string') : 'string'
  }
  return typeMap[jsonSchemaType ?? 'string'] ?? 'string'
}

function extractFields(schema: any, prefix = ''): Array<{ name: string; type: string }> {
  const fields: Array<{ name: string; type: string }> = []

  if (schema?.properties) {
    for (const [key, value] of Object.entries<any>(schema.properties)) {
      const fullName = prefix ? `${prefix}.${key}` : key
      if (value.type === 'object' && value.properties) {
        fields.push(...extractFields(value, fullName))
      } else {
        fields.push({ name: fullName, type: mapType(value.type) })
      }
    }
  } else if (schema?.fields && Array.isArray(schema.fields)) {
    for (const field of schema.fields) {
      const fullName = prefix ? `${prefix}.${field.name}` : field.name
      const type = typeof field.type === 'string' ? field.type : field.type?.type ?? 'string'
      fields.push({ name: fullName, type: mapType(type) })
    }
  }

  return fields
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, authMethod, apiKey, apiSecret, username, password, subject, version } = body

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'Registry URL is required' }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 })
    }

    const ver = version || 'latest'
    const schemaUrl = `${url.replace(/\/$/, '')}/subjects/${encodeURIComponent(subject)}/versions/${ver}`
    const headers = buildRegistryAuthHeaders({ authMethod, apiKey, apiSecret, username, password })

    const response = await fetch(schemaUrl, { headers })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json({
        success: false,
        error: `Registry returned ${response.status}: ${text || response.statusText}`,
      })
    }

    const data = await response.json()
    let parsedSchema: any
    try {
      parsedSchema = typeof data.schema === 'string' ? JSON.parse(data.schema) : data.schema
    } catch {
      return NextResponse.json({ success: false, error: 'Could not parse schema from registry response' })
    }

    const fields = extractFields(parsedSchema)

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields found in schema' })
    }

    return NextResponse.json({ success: true, fields, version: data.version })
  } catch (error) {
    structuredLogger.error('Schema registry schema fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
