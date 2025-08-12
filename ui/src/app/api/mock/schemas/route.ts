import { NextResponse } from 'next/server'

// Type definition for schema
interface Schema {
  id: string
  name: string
  version: string
  created_at: string
  updated_at: string
  schema: Record<string, any>
  mappings: Record<string, any>
}

// Mock data for schemas
const mockSchemas: Schema[] = [
  {
    id: 'schema-001',
    name: 'User Event Schema',
    version: '1.0.0',
    created_at: '2024-01-10T08:30:00Z',
    updated_at: '2024-01-15T11:20:00Z',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        event_type: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        data: { type: 'object' },
      },
      required: ['user_id', 'event_type', 'timestamp'],
    },
    mappings: {
      kafka_topic: 'user-events',
      clickhouse_table: 'user_events',
      field_mappings: {
        user_id: 'user_id',
        event_type: 'event_type',
        timestamp: 'timestamp',
        data: 'event_data',
      },
    },
  },
  {
    id: 'schema-002',
    name: 'Order Schema',
    version: '2.1.0',
    created_at: '2024-01-08T14:20:00Z',
    updated_at: '2024-01-15T10:15:00Z',
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        customer_id: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        status: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
      },
      required: ['order_id', 'customer_id', 'amount'],
    },
    mappings: {
      kafka_topic: 'orders',
      clickhouse_table: 'orders',
      field_mappings: {
        order_id: 'order_id',
        customer_id: 'customer_id',
        amount: 'amount',
        currency: 'currency',
        status: 'order_status',
        created_at: 'created_at',
      },
    },
  },
]

// GET /api/mock/schemas
export async function GET() {
  return NextResponse.json({
    success: true,
    schemas: mockSchemas,
    total: mockSchemas.length,
  })
}

// POST /api/mock/schemas
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const newSchema: Schema = {
      id: `schema-${Date.now()}`,
      name: body.name || 'New Schema',
      version: body.version || '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      schema: body.schema || {},
      mappings: body.mappings || {},
    }

    mockSchemas.push(newSchema)

    return NextResponse.json({
      success: true,
      schema: newSchema,
      message: 'Schema created successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create schema' }, { status: 500 })
  }
}
