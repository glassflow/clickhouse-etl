import { useCallback, useEffect, useState } from 'react'
import { extractEventFields } from '@/src/utils/common.client'
import { inferJsonType, getNestedValue } from '@/src/modules/clickhouse/utils'
import type { FieldTypeInfo } from '@/src/modules/kafka/types'

interface SchemaField {
  name: string
  type?: string
  userType?: string
  inferredType?: string
  isManuallyAdded?: boolean
  isRemoved?: boolean
}

interface TopicWithSchema {
  name?: string
  schema?: { fields?: SchemaField[] }
}

export interface UseTypeVerificationStateParams {
  eventData: unknown
  topic: TopicWithSchema | undefined
}

export function useTypeVerificationState({ eventData, topic }: UseTypeVerificationStateParams) {
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('string')
  const [newFieldError, setNewFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventData) {
      setFieldTypes([])
      return
    }

    const existingSchema = topic?.schema?.fields || []
    const existingSchemaMap = new Map<string, SchemaField>(existingSchema.map((f) => [f.name, f]))
    const inferredFields = extractEventFields(eventData)

    const inferredTypeInfo: FieldTypeInfo[] = inferredFields.map((fieldName) => {
      const value = getNestedValue(eventData, fieldName)
      const inferredType = inferJsonType(value) || 'string'
      const existingField = existingSchemaMap.get(fieldName)
      const userType = existingField?.userType || existingField?.type || inferredType

      return {
        name: fieldName,
        inferredType,
        userType,
        isManuallyAdded: false,
        isRemoved: existingField?.isRemoved || false,
      }
    })

    const manuallyAddedFields: FieldTypeInfo[] = existingSchema
      .filter((f) => f.isManuallyAdded && !inferredFields.includes(f.name))
      .map((f) => ({
        name: f.name,
        inferredType: '-',
        userType: f.userType || f.type || 'string',
        isManuallyAdded: true,
        isRemoved: f.isRemoved || false,
      }))

    setFieldTypes([...inferredTypeInfo, ...manuallyAddedFields])
  }, [eventData, topic])

  const handleTypeChange = useCallback((fieldName: string, newType: string) => {
    setFieldTypes((prev) => prev.map((field) => (field.name === fieldName ? { ...field, userType: newType } : field)))
  }, [])

  const validateFieldName = useCallback(
    (name: string): string | null => {
      const trimmedName = name.trim()
      if (!trimmedName) return 'Field name cannot be empty'
      const existingNames = fieldTypes.filter((f) => !f.isRemoved).map((f) => f.name)
      if (existingNames.includes(trimmedName)) return 'A field with this name already exists'
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmedName)) {
        return 'Field name must start with a letter or underscore and contain only letters, numbers, underscores, or dots'
      }
      return null
    },
    [fieldTypes],
  )

  const handleAddField = useCallback(() => {
    const error = validateFieldName(newFieldName)
    if (error) {
      setNewFieldError(error)
      return
    }
    setFieldTypes((prev) => [
      ...prev,
      {
        name: newFieldName.trim(),
        inferredType: '-',
        userType: newFieldType,
        isManuallyAdded: true,
        isRemoved: false,
      },
    ])
    setNewFieldName('')
    setNewFieldType('string')
    setNewFieldError(null)
  }, [newFieldName, newFieldType, validateFieldName])

  const handleRemoveField = useCallback((fieldName: string) => {
    setFieldTypes((prev) =>
      prev
        .map((field) => {
          if (field.name !== fieldName) return field
          if (field.isManuallyAdded) return null
          return { ...field, isRemoved: true }
        })
        .filter((f): f is FieldTypeInfo => f !== null),
    )
  }, [])

  const handleRestoreField = useCallback((fieldName: string) => {
    setFieldTypes((prev) => prev.map((field) => (field.name === fieldName ? { ...field, isRemoved: false } : field)))
  }, [])

  const clearNewFieldError = useCallback(() => {
    setNewFieldError(null)
  }, [])

  const activeFieldCount = fieldTypes.filter((f) => !f.isRemoved).length
  const canContinue = activeFieldCount > 0

  return {
    fieldTypes,
    newFieldName,
    newFieldType,
    newFieldError,
    setNewFieldName,
    setNewFieldType,
    clearNewFieldError,
    handleTypeChange,
    handleAddField,
    handleRemoveField,
    handleRestoreField,
    canContinue,
  }
}
