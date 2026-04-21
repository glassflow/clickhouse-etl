import { isOtlpSource } from '@/src/config/source-types'

interface SchemaField {
  name: string
  type: string
}

/**
 * Get schema fields based on source type.
 * For OTLP: returns predefined fields from otlpStore.
 * For Kafka: returns fields from the first topic's schema or selected event.
 */
export function getSourceSchemaFields(
  sourceType: string,
  otlpSchemaFields: SchemaField[],
  topicSchemaFields: SchemaField[] | undefined,
  topicEvent: Record<string, unknown> | null,
): SchemaField[] {
  if (isOtlpSource(sourceType)) {
    return otlpSchemaFields
  }

  // Kafka path: schema fields from type verification step
  if (topicSchemaFields && topicSchemaFields.length > 0) {
    return topicSchemaFields
      .filter((f: any) => !f.isRemoved)
      .map((f: any) => ({
        name: f.name,
        type: f.userType || f.type || 'string',
      }))
  }

  // Kafka fallback: extract from event
  if (topicEvent) {
    const fields: SchemaField[] = []
    const extractFields = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key
        let fieldType = 'string'
        if (typeof value === 'number') {
          fieldType = Number.isInteger(value) ? 'int' : 'float64'
        } else if (typeof value === 'boolean') {
          fieldType = 'bool'
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractFields(value as Record<string, unknown>, fieldName)
          continue
        }
        fields.push({ name: fieldName, type: fieldType })
      }
    }
    extractFields(topicEvent)
    return fields
  }

  return []
}
