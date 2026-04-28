import { NextResponse } from 'next/server'
import avsc from 'avsc'
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

    // Attempt to decode the Avro event bytes using the fetched schema (non-fatal)
    let decodedEvent: Record<string, unknown> | undefined
    const isAvroSchema =
      schemaData.schemaType === 'AVRO' ||
      (!schemaData.schemaType && parsedSchema.type === 'record' && Array.isArray(parsedSchema.fields))
    if (isAvroSchema) {
      const rawBytes = Buffer.from(rawBase64, 'base64')
      // Confluent wire format: skip 5-byte header (magic byte + 4-byte schema ID)
      const avroPayload = rawBytes.subarray(5)
      // Try decoding with two strategies; avsc union wrapping varies by schema
      const decodeStrategies = [
        () => avsc.Type.forSchema(parsedSchema, { wrapUnions: 'auto' }).fromBuffer(avroPayload),
        () => avsc.Type.forSchema(parsedSchema).fromBuffer(avroPayload),
      ]
      for (const decode of decodeStrategies) {
        try {
          decodedEvent = decode() as Record<string, unknown>
          break
        } catch {
          // try next strategy
        }
      }
      if (!decodedEvent) {
        structuredLogger.warn('Avro decode failed for all strategies', { schemaId })
        // Fallback: build a synthetic event from the schema fields so downstream
        // steps have real field names instead of the Avro error envelope
        decodedEvent = Object.fromEntries(fields.map((f) => [f.name, null]))
      }
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

    return NextResponse.json({ success: true, schemaId, subject, version, fields, decodedEvent })
  } catch (error) {
    structuredLogger.error('Schema registry resolve-from-event failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
