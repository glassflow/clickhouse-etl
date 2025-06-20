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

// Mock data for schemas (shared with parent route)
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

// Helper function to find schema by ID
const findSchema = (id: string): Schema | undefined => {
  return mockSchemas.find((s) => s.id === id)
}

// GET /api/mock/schemas/{id}
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const schema = findSchema(params.id)

  if (!schema) {
    return NextResponse.json({ success: false, error: 'Schema not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, schema })
}

// PATCH /api/mock/schemas/{id}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const schema = findSchema(params.id)

    if (!schema) {
      return NextResponse.json({ success: false, error: 'Schema not found' }, { status: 404 })
    }

    // Update schema
    Object.assign(schema, {
      ...body,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      schema,
      message: 'Schema updated successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update schema' }, { status: 500 })
  }
}

// DELETE /api/mock/schemas/{id}
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const schemaIndex = mockSchemas.findIndex((s) => s.id === params.id)

  if (schemaIndex === -1) {
    return NextResponse.json({ success: false, error: 'Schema not found' }, { status: 404 })
  }

  const deletedSchema = mockSchemas.splice(schemaIndex, 1)[0]

  return NextResponse.json({
    success: true,
    message: 'Schema deleted successfully',
    schema: deletedSchema,
  })
}
