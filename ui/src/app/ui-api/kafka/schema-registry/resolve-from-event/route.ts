import { NextResponse } from 'next/server'
import { buildRegistryAuthHeaders } from '../_auth'
import { structuredLogger } from '@/src/observability'

// Confluent wire format: [0x00 magic byte][4-byte big-endian schema ID][payload]
const MAGIC_BYTE = 0x00

function extractSchemaId(rawBase64: string): number | null {
  try {
    const bytes = Buffer.from(rawBase64, 'base64')
    if (bytes.length < 5 || bytes[0] !== MAGIC_BYTE) return null
    return bytes.readUInt32BE(1)
  } catch {
    return null
  }
}

const typeMap: Record<string, string> = {
  integer: 'int',
  number: 'float',
  boolean: 'bool',
  string: 'string',
  array: 'array',
  object: 'bytes',
  null: 'string',
}

function mapType(t: string | string[] | undefined): string {
  if (Array.isArray(t)) {
    const nonNull = t.find((x) => x !== 'null')
    return nonNull ? (typeMap[nonNull] ?? 'string') : 'string'
  }
  return typeMap[t ?? 'string'] ?? 'string'
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
    const { url, authMethod, apiKey, apiSecret, username, password, rawBase64 } = body

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'Registry URL is required' }, { status: 400 })
    }
    if (!rawBase64) {
      return NextResponse.json({ success: false, error: 'No raw event bytes provided' })
    }

    const schemaId = extractSchemaId(rawBase64)
    if (schemaId === null) {
      return NextResponse.json({ success: false, error: 'Not Confluent wire format' })
    }

    const headers = buildRegistryAuthHeaders({ authMethod, apiKey, apiSecret, username, password })
    const baseUrl = url.replace(/\/$/, '')

    const schemaResponse = await fetch(`${baseUrl}/schemas/ids/${schemaId}`, { headers })
    if (!schemaResponse.ok) {
      const text = await schemaResponse.text().catch(() => '')
      return NextResponse.json({
        success: false,
        error: `Registry returned ${schemaResponse.status}: ${text || schemaResponse.statusText}`,
      })
    }

    const schemaData = await schemaResponse.json()
    let parsedSchema: any
    try {
      parsedSchema = typeof schemaData.schema === 'string' ? JSON.parse(schemaData.schema) : schemaData.schema
    } catch {
      return NextResponse.json({ success: false, error: 'Could not parse schema from registry response' })
    }

    const fields = extractFields(parsedSchema)
    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields found in schema' })
    }

    // Attempt to resolve subject/version for this schema ID (non-fatal)
    let subject: string | undefined
    let version: number | undefined
    try {
      const versionsResponse = await fetch(`${baseUrl}/schemas/ids/${schemaId}/versions`, { headers })
      if (versionsResponse.ok) {
        const versionsData = await versionsResponse.json()
        if (Array.isArray(versionsData) && versionsData.length > 0) {
          subject = versionsData[0].subject
          version = versionsData[0].version
        }
      }
    } catch {
      // Non-fatal — subject/version is informational only
    }

    return NextResponse.json({ success: true, schemaId, subject, version, fields })
  } catch (error) {
    structuredLogger.error('Schema registry resolve-from-event failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
