import { useState, useEffect, useCallback } from 'react'
import {
  findBestMatchingField,
  getNestedValue,
  getVerifiedTypeFromTopic,
} from '../utils'
import { valueToFieldType } from '@/src/utils/type-conversion'
import { extractEventFields } from '@/src/utils/common.client'
import type { TableColumn } from '../types'
import type { MappingMode } from '../types'
import { useStore } from '@/src/store'
import { isOtlpSource } from '@/src/config/source-types'

export interface UseClickhouseMapperEventFieldsParams {
  mode: MappingMode
  destinationPath: 'create' | 'existing'
  selectedTopic: any
  primaryTopic: any
  secondaryTopic: any
  transformationStore: {
    transformationConfig: { enabled: boolean; fields: unknown[] }
    getIntermediarySchema: () => Array<{ name: string; type: string }>
  }
  mappedColumns: TableColumn[]
  setMappedColumns: (columns: TableColumn[] | ((prev: TableColumn[]) => TableColumn[])) => void
  clickhouseDestination: any
  setClickhouseDestination: (dest: any) => void
}

/**
 * Hook that owns event fields and event data (single + join), and all event-driven effects:
 * populate event fields, auto-map on data change, infer missing jsonType.
 * Receives mappedColumns/setMappedColumns from the state hook so mapping stays in one place.
 */
export function useClickhouseMapperEventFields({
  mode,
  destinationPath,
  selectedTopic,
  primaryTopic,
  secondaryTopic,
  transformationStore,
  mappedColumns,
  setMappedColumns,
  clickhouseDestination,
  setClickhouseDestination,
}: UseClickhouseMapperEventFieldsParams) {
  const { coreStore, otlpStore } = useStore()
  const isOtlp = isOtlpSource(coreStore.sourceType)

  const selectedEvent = selectedTopic?.selectedEvent

  const [eventFields, setEventFields] = useState<string[]>([])
  const [eventData, setEventData] = useState<any>(selectedEvent?.event || null)
  const [primaryEventData, setPrimaryEventData] = useState<any>(
    primaryTopic?.selectedEvent?.event?.event ?? primaryTopic?.selectedEvent?.event ?? null,
  )
  const [primaryEventFields, setPrimaryEventFields] = useState<string[]>([])
  const [secondaryEventFields, setSecondaryEventFields] = useState<string[]>([])

  // Load event fields when event data changes (single mode)
  useEffect(() => {
    if (mode !== 'single') return

    // OTLP: use predefined schema fields instead of sampling a Kafka event
    if (isOtlp && otlpStore.schemaFields.length > 0) {
      const otlpFieldNames = otlpStore.schemaFields.map((f) => f.name)
      setEventFields(otlpFieldNames)

      // For the 'create' path, the auto-generate effect in ClickhouseMapper builds columns
      // from scratch using orderByOptions (these event fields). Auto-mapping here would apply
      // stale existing-table columns that haven't been cleared by the sync effect yet.
      if (destinationPath === 'create') return
      if (clickhouseDestination?.mapping?.some((col: any) => col.eventField)) return
      if (mappedColumns.length > 0) {
        const fieldTypeMap = new Map(otlpStore.schemaFields.map((f) => [f.name, f.type]))
        const updatedColumns = [...mappedColumns]
        let hasChanges = false
        updatedColumns.forEach((col, index) => {
          const matchingField = findBestMatchingField(col.name, otlpFieldNames)
          if (matchingField) {
            hasChanges = true
            updatedColumns[index] = {
              ...col,
              eventField: matchingField,
              jsonType: fieldTypeMap.get(matchingField) ?? 'string',
            }
          }
        })
        if (hasChanges) {
          setMappedColumns(updatedColumns)
          setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
        }
      }
      return
    }

    const isTransformationEnabled =
      transformationStore.transformationConfig.enabled &&
      transformationStore.transformationConfig.fields.length > 0

    if (isTransformationEnabled) {
      const intermediarySchema = transformationStore.getIntermediarySchema()
      if (intermediarySchema.length > 0) {
        const transformedFields = intermediarySchema.map((field) => field.name)
        setEventFields(transformedFields)
        const fieldTypeMap = new Map(intermediarySchema.map((field) => [field.name, field.type]))

        if (clickhouseDestination?.mapping?.some((col: any) => col.eventField)) return
        if (mappedColumns.length > 0 && transformedFields.length > 0) {
          const updatedColumns = [...mappedColumns]
          let hasChanges = false
          updatedColumns.forEach((col, index) => {
            const matchingField = findBestMatchingField(col.name, transformedFields)
            if (matchingField) {
              hasChanges = true
              const fieldType = fieldTypeMap.get(matchingField) || 'string'
              updatedColumns[index] = { ...col, eventField: matchingField, jsonType: fieldType }
            }
          })
          if (hasChanges) {
            setMappedColumns(updatedColumns)
            setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
          }
        }
      }
      return
    }

    if (selectedEvent?.event) {
      const data = selectedEvent.event
      setEventData(data)
      const fields = extractEventFields(data)
      setEventFields(fields)

      if (clickhouseDestination?.mapping?.some((col: any) => col.eventField)) return
      if (mappedColumns.length > 0 && fields.length > 0) {
        const updatedColumns = [...mappedColumns]
        let hasChanges = false
        updatedColumns.forEach((col, index) => {
          const matchingField = findBestMatchingField(col.name, fields)
          if (matchingField) {
            hasChanges = true
            const verifiedType = getVerifiedTypeFromTopic(selectedTopic, matchingField)
            updatedColumns[index] = {
              ...col,
              eventField: matchingField,
              jsonType: verifiedType || valueToFieldType(getNestedValue(data, matchingField)),
            }
          }
        })
        if (hasChanges) {
          setMappedColumns(updatedColumns)
          setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
        }
      }
    }
  }, [
    mode,
    destinationPath,
    isOtlp,
    otlpStore.schemaFields,
    selectedEvent?.event,
    selectedTopic,
    clickhouseDestination,
    mappedColumns,
    setMappedColumns,
    setClickhouseDestination,
    transformationStore,
  ])

  // Primary event data update (join/dedup mode)
  useEffect(() => {
    if (mode === 'single') return
    if (primaryTopic?.selectedEvent?.event) {
      setPrimaryEventData(primaryTopic.selectedEvent.event)
    }
  }, [primaryTopic?.selectedEvent?.event, mode])

  // Load event fields for join/dedup mode - primary
  useEffect(() => {
    if (mode === 'single') return
    if (primaryEventData) {
      const fields = extractEventFields(primaryEventData)
      setPrimaryEventFields(fields)
      setEventFields([...fields])
    }
  }, [primaryEventData, mode])

  // Load event fields for join/dedup mode - secondary
  useEffect(() => {
    if (mode === 'single') return
    if (secondaryTopic?.selectedEvent?.event) {
      const fields = extractEventFields(secondaryTopic.selectedEvent.event)
      setSecondaryEventFields(fields)
      setEventFields((prev) => [...prev, ...fields])
    }
  }, [secondaryTopic?.selectedEvent?.event, mode])

  // Auto-map for join/dedup when both topic fields and mapped columns exist
  useEffect(() => {
    if (mode === 'single') return
    if (
      primaryEventFields.length === 0 ||
      secondaryEventFields.length === 0 ||
      mappedColumns.length === 0
    )
      return
    if (clickhouseDestination?.mapping?.some((col: any) => col.eventField)) return

    const updatedColumns = [...mappedColumns]
    let hasChanges = false
    updatedColumns.forEach((col, index) => {
      if (col.eventField) return
      let matchingField = findBestMatchingField(col.name, primaryEventFields)
      let source: 'primary' | 'secondary' = 'primary'
      let sourceData = primaryEventData
      if (!matchingField) {
        matchingField = findBestMatchingField(col.name, secondaryEventFields)
        source = 'secondary'
        sourceData = secondaryTopic?.selectedEvent?.event
      }
      if (matchingField && sourceData) {
        const sourceTopicName = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
        const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic
        const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
        const jsonType =
          verifiedType || valueToFieldType(getNestedValue(sourceData, matchingField)) || 'string'
        updatedColumns[index] = {
          ...col,
          eventField: matchingField,
          jsonType,
          sourceTopic: sourceTopicName,
        }
        hasChanges = true
      }
    })
    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
    }
  }, [
    mode,
    primaryEventFields,
    secondaryEventFields,
    mappedColumns,
    clickhouseDestination,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    primaryTopic,
    secondaryTopic,
    setMappedColumns,
    setClickhouseDestination,
  ])

  // Infer missing jsonType for already-mapped fields after hydration
  useEffect(() => {
    if (mappedColumns.length === 0) return

    if (mode === 'single') {
      const isTransformationEnabled =
        transformationStore.transformationConfig.enabled &&
        transformationStore.transformationConfig.fields.length > 0
      let changed = false
      const updated = mappedColumns.map((col) => {
        if (!col.eventField || (col.jsonType && col.jsonType !== '')) return col
        if (isTransformationEnabled) {
          const intermediarySchema = transformationStore.getIntermediarySchema()
          const schemaField = intermediarySchema.find((field) => field.name === col.eventField)
          if (schemaField?.type) {
            changed = true
            return { ...col, jsonType: schemaField.type }
          }
        } else {
          const verifiedType = getVerifiedTypeFromTopic(selectedTopic, col.eventField)
          if (verifiedType) {
            changed = true
            return { ...col, jsonType: verifiedType }
          }
          if (!eventData) return col
          const value = getNestedValue(eventData, col.eventField)
          const inferred = valueToFieldType(value)
          if (inferred) {
            changed = true
            return { ...col, jsonType: inferred }
          }
        }
        return col
      })
      if (changed) {
        setMappedColumns(updated)
        setClickhouseDestination({ ...clickhouseDestination, mapping: updated })
      }
    } else {
      const primaryData = primaryEventData
      const secondaryData = secondaryTopic?.selectedEvent?.event
      if (!primaryData && !secondaryData) return
      let changed = false
      const updated = mappedColumns.map((col) => {
        if (!col.eventField || (col.jsonType && col.jsonType !== '')) return col
        let topicForSchema: any = null
        let sourceData: any = null
        if (col.sourceTopic) {
          if (primaryTopic?.name && col.sourceTopic === primaryTopic.name) {
            topicForSchema = primaryTopic
            sourceData = primaryData
          } else if (secondaryTopic?.name && col.sourceTopic === secondaryTopic.name) {
            topicForSchema = secondaryTopic
            sourceData = secondaryData
          }
        }
        if (!topicForSchema) {
          topicForSchema = primaryTopic || secondaryTopic
          sourceData = primaryData || secondaryData
        }
        const verifiedType = getVerifiedTypeFromTopic(topicForSchema, col.eventField)
        if (verifiedType) {
          changed = true
          return { ...col, jsonType: verifiedType }
        }
        const value = sourceData ? getNestedValue(sourceData, col.eventField) : undefined
        const inferred = valueToFieldType(value)
        if (inferred) {
          changed = true
          return { ...col, jsonType: inferred }
        }
        return col
      })
      if (changed) {
        setMappedColumns(updated)
        setClickhouseDestination({ ...clickhouseDestination, mapping: updated })
      }
    }
  }, [
    mode,
    eventData,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    mappedColumns,
    primaryTopic,
    secondaryTopic,
    selectedTopic,
    transformationStore,
    clickhouseDestination,
    setMappedColumns,
    setClickhouseDestination,
  ])

  const performAutoMappingJoinMode = useCallback(() => {
    if (
      mode === 'single' ||
      primaryEventFields.length === 0 ||
      secondaryEventFields.length === 0 ||
      mappedColumns.length === 0
    )
      return false

    const updatedColumns = [...mappedColumns]
    let hasChanges = false
    updatedColumns.forEach((col, index) => {
      if (col.eventField) return
      let matchingField = findBestMatchingField(col.name, primaryEventFields)
      let source: 'primary' | 'secondary' = 'primary'
      let sourceData = primaryEventData
      if (!matchingField) {
        matchingField = findBestMatchingField(col.name, secondaryEventFields)
        source = 'secondary'
        sourceData = secondaryTopic?.selectedEvent?.event
      }
      if (matchingField && sourceData) {
        const sourceTopicName = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
        const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic
        const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
        const jsonType =
          verifiedType || valueToFieldType(getNestedValue(sourceData, matchingField)) || 'string'
        updatedColumns[index] = {
          ...col,
          eventField: matchingField,
          jsonType,
          sourceTopic: sourceTopicName,
        }
        hasChanges = true
      }
    })
    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
    }
    return hasChanges
  }, [
    mode,
    primaryEventFields,
    secondaryEventFields,
    mappedColumns,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    primaryTopic,
    secondaryTopic,
    clickhouseDestination,
    setMappedColumns,
    setClickhouseDestination,
  ])

  const performAutoMapping = useCallback(() => {
    if (mappedColumns.length === 0) return false

    const isTransformationEnabled =
      mode === 'single' &&
      transformationStore.transformationConfig.enabled &&
      transformationStore.transformationConfig.fields.length > 0

    const updatedColumns = mappedColumns.map((col) => ({
      ...col,
      eventField: '',
      jsonType: '',
      sourceTopic: undefined as string | undefined,
    }))
    let hasChanges = false

    if (mode === 'single') {
      if (isOtlp && otlpStore.schemaFields.length > 0) {
        const otlpFieldNames = otlpStore.schemaFields.map((f) => f.name)
        const fieldTypeMap = new Map(otlpStore.schemaFields.map((f) => [f.name, f.type]))
        updatedColumns.forEach((col, index) => {
          const matchingField = findBestMatchingField(col.name, otlpFieldNames)
          if (matchingField) {
            updatedColumns[index] = {
              ...col,
              eventField: matchingField,
              jsonType: fieldTypeMap.get(matchingField) ?? 'string',
            }
            hasChanges = true
          }
        })
      } else if (isTransformationEnabled) {
        const intermediarySchema = transformationStore.getIntermediarySchema()
        if (intermediarySchema.length > 0) {
          const transformedFields = intermediarySchema.map((field) => field.name)
          const fieldTypeMap = new Map(intermediarySchema.map((field) => [field.name, field.type]))
          updatedColumns.forEach((col, index) => {
            const matchingField = findBestMatchingField(col.name, transformedFields)
            if (matchingField) {
              const fieldType = fieldTypeMap.get(matchingField) || 'string'
              updatedColumns[index] = { ...col, eventField: matchingField, jsonType: fieldType }
              hasChanges = true
            }
          })
        }
      } else {
        if (eventFields.length > 0 && eventData) {
          updatedColumns.forEach((col, index) => {
            const matchingField = findBestMatchingField(col.name, eventFields)
            if (matchingField) {
              const verifiedType = getVerifiedTypeFromTopic(selectedTopic, matchingField)
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: verifiedType || valueToFieldType(getNestedValue(eventData, matchingField)),
              }
              hasChanges = true
            }
          })
        }
      }
    } else {
      if (primaryEventFields.length === 0 && secondaryEventFields.length === 0) return false
      updatedColumns.forEach((col, index) => {
        let matchingField = findBestMatchingField(col.name, primaryEventFields)
        let source: 'primary' | 'secondary' = 'primary'
        let sourceData = primaryEventData
        if (!matchingField) {
          matchingField = findBestMatchingField(col.name, secondaryEventFields)
          source = 'secondary'
          sourceData = secondaryTopic?.selectedEvent?.event
        }
        if (matchingField && sourceData) {
          const sourceTopicName = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
          const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic
          const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
          const jsonType =
            verifiedType || valueToFieldType(getNestedValue(sourceData, matchingField)) || 'string'
          updatedColumns[index] = {
            ...col,
            eventField: matchingField,
            jsonType,
            sourceTopic: sourceTopicName,
          }
          hasChanges = true
        }
      })
    }

    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({ ...clickhouseDestination, mapping: updatedColumns })
    }
    return hasChanges
  }, [
    mode,
    isOtlp,
    otlpStore.schemaFields,
    mappedColumns,
    eventFields,
    eventData,
    selectedTopic,
    primaryEventFields,
    secondaryEventFields,
    primaryEventData,
    primaryTopic,
    secondaryTopic,
    clickhouseDestination,
    setMappedColumns,
    setClickhouseDestination,
    transformationStore,
  ])

  const mapEventFieldToColumn = useCallback(
    (index: number, eventField: string, source?: 'primary' | 'secondary') => {
      const updatedColumns = [...mappedColumns]
      const isTransformationEnabled =
        mode === 'single' &&
        transformationStore.transformationConfig.enabled &&
        transformationStore.transformationConfig.fields.length > 0

      let inferredType: string
      if (isOtlp && eventField && mode === 'single') {
        const schemaField = otlpStore.schemaFields.find((f) => f.name === eventField)
        inferredType = schemaField?.type ?? 'string'
      } else if (isTransformationEnabled && eventField) {
        const intermediarySchema = transformationStore.getIntermediarySchema()
        const schemaField = intermediarySchema.find((field) => field.name === eventField)
        inferredType = schemaField?.type || 'string'
      } else {
        if (mode === 'single') {
          const verifiedType = eventField
            ? getVerifiedTypeFromTopic(selectedTopic, eventField)
            : undefined
          if (verifiedType) {
            inferredType = verifiedType
          } else {
            const fieldValue = eventField ? getNestedValue(eventData, eventField) : undefined
            inferredType = eventField
              ? valueToFieldType(fieldValue)
              : (updatedColumns[index].jsonType ?? 'string')
          }
        } else {
          const topicForSchema = source === 'secondary' ? secondaryTopic : primaryTopic
          const verifiedType = eventField
            ? getVerifiedTypeFromTopic(topicForSchema, eventField)
            : undefined
          if (verifiedType) {
            inferredType = verifiedType
          } else {
            const sourceEventData =
              source === 'secondary'
                ? secondaryTopic?.selectedEvent?.event?.event
                : primaryTopic?.selectedEvent?.event?.event
            const sourceData = source === 'secondary' ? secondaryTopic?.selectedEvent?.event : primaryEventData
            const data = sourceEventData ?? sourceData
            const fieldValue = data ? getNestedValue(data, eventField) : undefined
            inferredType = eventField
              ? valueToFieldType(fieldValue)
              : (updatedColumns[index].jsonType ?? 'string')
          }
        }
        if (!inferredType && eventField) inferredType = 'string'
      }

      const topicName =
        mode !== 'single' && source
          ? source === 'secondary'
            ? secondaryTopic?.name
            : primaryTopic?.name
          : undefined

      updatedColumns[index] = {
        ...updatedColumns[index],
        eventField,
        jsonType: inferredType!,
        ...(topicName && { sourceTopic: topicName }),
      }

      setMappedColumns(updatedColumns)
    },
    [
      mode,
      isOtlp,
      otlpStore.schemaFields,
      mappedColumns,
      eventData,
      primaryTopic,
      secondaryTopic,
      primaryEventData,
      selectedTopic,
      transformationStore,
      setMappedColumns,
    ],
  )

  return {
    eventFields,
    eventData,
    primaryEventFields,
    secondaryEventFields,
    primaryEventData,
    performAutoMapping,
    performAutoMappingJoinMode,
    mapEventFieldToColumn,
  }
}
