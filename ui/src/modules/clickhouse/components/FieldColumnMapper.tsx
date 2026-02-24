'use client'

import { useEffect } from 'react'
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/src/components/ui/table'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { DualSearchableSelect } from '@/src/components/common/DualSearchableSelect'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
// Icons removed since status column is no longer used
import { ColumnMappingType } from '@/src/scheme/clickhouse.scheme'
import { JSON_DATA_TYPES } from '@/src/config/constants'
import { TableColumn } from '../types'
import { useState } from 'react'
import { isTypeCompatible } from '../utils'
import Image from 'next/image'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { CacheRefreshButton } from './CacheRefreshButton'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/utils/common.client'

// Import topic icons
import deduplicateIcon from '@/src/images/deduplicate.svg'
import leftTopicIcon from '@/src/images/left-topic.svg'
import rightTopicIcon from '@/src/images/right-topic.svg'
import MoveRightIcon from '@/src/images/move-right.svg'

interface FieldColumnMapperProps {
  eventFields: string[]
  mappedColumns: ColumnMappingType[]
  updateColumnMapping: (index: number, field: keyof TableColumn, value: any) => void
  mapEventFieldToColumn: (index: number, eventField: string, source?: 'primary' | 'secondary') => void
  primaryEventFields?: string[]
  secondaryEventFields?: string[]
  primaryTopicName?: string
  secondaryTopicName?: string
  isJoinMapping?: boolean
  readOnly?: boolean
  typesReadOnly?: boolean // NEW: Make data types read-only (for when types are verified in earlier step)
  unmappedNonNullableColumns?: string[]
  unmappedDefaultColumns?: string[] // NEW: columns with DEFAULT that are unmapped
  onRefreshTableSchema: () => void
  onAutoMap: () => boolean // Trigger automatic field-to-column mapping
  selectedDatabase: string
  selectedTable: string
}

export function FieldColumnMapper({
  eventFields,
  mappedColumns,
  updateColumnMapping,
  mapEventFieldToColumn,
  primaryEventFields = [],
  secondaryEventFields = [],
  primaryTopicName = 'Primary Topic',
  secondaryTopicName = 'Secondary Topic',
  isJoinMapping = false,
  readOnly,
  typesReadOnly = false, // NEW: Make data types read-only
  unmappedNonNullableColumns = [],
  unmappedDefaultColumns = [], // NEW
  onRefreshTableSchema,
  onAutoMap,
  selectedDatabase,
  selectedTable,
}: FieldColumnMapperProps) {
  const [openSelectIndex, setOpenSelectIndex] = useState<number | null>(null)
  const analytics = useJourneyAnalytics()
  const handleSelectOpen = (index: number, isOpen: boolean) => {
    setOpenSelectIndex(isOpen ? index : null)
  }

  // Helper function to check if a column is unmapped and non-nullable
  const isUnmappedNonNullable = (column: ColumnMappingType) => {
    return unmappedNonNullableColumns.includes(column.name) && !column.eventField
  }

  // Helper function to check if a column has DEFAULT and is unmapped (warning)
  const isUnmappedWithDefault = (column: ColumnMappingType) => {
    return unmappedDefaultColumns.includes(column.name) && !column.eventField
  }

  // Helper function to check if type mapping is incompatible
  const isTypeIncompatible = (column: ColumnMappingType) => {
    return column.eventField && column.jsonType && !isTypeCompatible(column.jsonType, column.type)
  }

  // track loading of the component after successful connection to ClickHouse
  useEffect(() => {
    analytics.destination.columnsShowed({
      count: eventFields?.length || 0,
    })
  }, [eventFields])

  // Function to render the source topic icon based on the source
  const renderSourceTopicIcon = (column: ColumnMappingType) => {
    if (isJoinMapping) {
      // For join mapping, show left or right icon based on the source
      if (column.sourceTopic === primaryTopicName) {
        return <Image src={leftTopicIcon} alt="Primary Topic" height={20} width={20} />
      } else if (column.sourceTopic === secondaryTopicName) {
        return <Image src={rightTopicIcon} alt="Secondary Topic" height={20} width={20} />
      } else {
        // Fallback: if sourceTopic is missing but we're in join mode, show primary icon
        // This handles cases where columns were mapped before join mode was properly initialized
        console.warn(`⚠️ Column "${column.name}" missing sourceTopic in join mode. Using primary icon as fallback.`)
        return <Image src={leftTopicIcon} alt="Primary Topic (Fallback)" height={20} width={20} />
      }
    }

    // Default icon for deduplication or when no source is available
    return <Image src={MoveRightIcon} alt="Topic" height={20} width={20} />
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-lg font-medium text-content">
          Map incoming event fields to ClickHouse table columns.
          {readOnly && <span className="text-sm text-gray-500 ml-2">(Read-only)</span>}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="custom"
            onClick={onAutoMap}
            disabled={readOnly}
            className={cn(
              'transition-all duration-200',
              {
                'opacity-50 cursor-not-allowed': readOnly,
                'text-muted-foreground': readOnly,
              },
            )}
            title="Auto-map event fields to columns by name"
          >
            <SparklesIcon
              className={cn('h-4 w-4', {
                'text-muted-foreground opacity-50': readOnly,
              })}
            />
            <span
              className={cn({
                'text-muted-foreground opacity-50': readOnly,
              })}
            >
              Auto-Map
            </span>
          </Button>
          <CacheRefreshButton
            type="tableSchema"
            database={selectedDatabase}
            table={selectedTable}
            onRefresh={async () => onRefreshTableSchema()}
            size="sm"
            variant="outline"
            disabled={readOnly}
          />
        </div>
        {/* TypeCompatibilityInfo is temporarily hidden */}
        {/* <TypeCompatibilityInfo /> */}
      </div>

      <Table
        className={`[&_tr]:border-0 [&_td]:border-0 [&_th]:border-0 [&_thead]:border-0 [&_tbody]:border-0 border-0 table-fixed w-full ${readOnly ? 'opacity-75' : ''}`}
      >
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-0">
            <TableHead className="text-content border-0 w-[40%]">Fields in incoming event</TableHead>
            <TableHead className="text-content border-0 w-[25%]">Data Type (incoming)</TableHead>
            <TableHead className="text-content text-center border-0 w-[5%]">Topic</TableHead>
            <TableHead className="text-content border-0 w-[40%]">Destination column</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-0">
          {mappedColumns.map((column, index) => {
            const isRequiredField = isUnmappedNonNullable(column)
            const hasDefaultWarning = isUnmappedWithDefault(column)
            const hasTypeError = isTypeIncompatible(column)
            const hasAnyError = isRequiredField || hasTypeError
            const hasAnyIssue = hasAnyError || hasDefaultWarning // Include warning in spacing
            return (
              <TableRow
                key={column.name}
                className={`border-0 ${!readOnly ? 'hover:bg-[var(--color-background-neutral-faded)]' : ''}`}
                style={{
                  transition: 'background-color 0.2s ease-in-out',
                }}
              >
                <TableCell className="w-[30%]">
                  <div>
                    {isJoinMapping ? (
                      <DualSearchableSelect
                        primaryOptions={primaryEventFields}
                        secondaryOptions={secondaryEventFields}
                        selectedOption={column.eventField}
                        onSelect={(option, source) => mapEventFieldToColumn(index, option || '', source)}
                        placeholder="Select event field"
                        className="w-full"
                        error={isRequiredField ? 'This field is not nullable, enter a value' : ''}
                        primaryLabel={primaryTopicName}
                        secondaryLabel={secondaryTopicName}
                        open={openSelectIndex === index}
                        onOpenChange={(isOpen) => handleSelectOpen(index, isOpen)}
                        disabled={readOnly}
                      />
                    ) : (
                      <SearchableSelect
                        availableOptions={eventFields}
                        selectedOption={column.eventField}
                        onSelect={(option) => mapEventFieldToColumn(index, option || '')}
                        placeholder="Select event field"
                        className="w-full"
                        error={isRequiredField ? 'This field is not nullable, enter a value' : ''}
                        open={openSelectIndex === index}
                        onOpenChange={(isOpen) => handleSelectOpen(index, isOpen)}
                        disabled={readOnly}
                        readOnly={readOnly}
                        reserveErrorSpace={false}
                      />
                    )}
                    {/* Show error/warning text or transparent placeholder to maintain alignment */}
                    {hasAnyIssue && (
                      <div className="text-xs font-medium leading-tight overflow-hidden mt-1">
                        {isRequiredField ? (
                          <span className="input-description-error">This field is not nullable, enter a value</span>
                        ) : hasDefaultWarning ? (
                          <span className="text-[var(--color-foreground-warning)]">
                            Has default value - will be auto-populated if unmapped
                          </span>
                        ) : (
                          <span className="text-transparent">Placeholder for alignment</span>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-[25%]">
                  <div>
                    {typesReadOnly ? (
                      // Read-only display when types are verified in earlier step
                      <div
                        className={cn(
                          'w-full h-10 px-3 flex items-center rounded-md bg-[var(--surface-bg-sunken)] border text-content',
                          hasTypeError ? 'border-2 border-[var(--control-border-error)]' : 'border-[var(--surface-border)]'
                        )}
                      >
                        {column.jsonType ?? ''}
                      </div>
                    ) : (
                      // Editable dropdown when types can be changed
                      <Select
                        value={column.jsonType || ''}
                        onValueChange={(value) => updateColumnMapping(index, 'jsonType', value)}
                        disabled={readOnly}
                      >
                        <SelectTrigger
                          error={!!hasTypeError}
                          className="w-full transition-colors text-content"
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--color-background-neutral-faded)] border-[var(--color-border-neutral)] shadow-md text-content select-content-custom">
                          {JSON_DATA_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="text-content select-item-custom">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {/* Show error text or transparent placeholder to maintain alignment */}
                    {hasAnyIssue && (
                      <div className="text-xs font-medium leading-tight overflow-hidden mt-1">
                        {hasTypeError ? (
                          <span className="text-red-600">
                            Type {column.jsonType} is incompatible with {column.type}
                          </span>
                        ) : (
                          <span className="text-transparent">Placeholder for alignment</span>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-content w-[5%] align-left">
                  <div className="flex justify-center items-center h-full">{renderSourceTopicIcon(column)}</div>
                  {hasAnyIssue && (
                    <div className="text-xs font-medium leading-tight overflow-hidden mt-1">
                      <span className="text-transparent">Placeholder for alignment</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-content w-[40%]">
                  <div className="flex justify-between bg-[#212121] my-1 rounded-sm p-3">
                    <span>{column.name}</span>
                    <span className="text-xs text-content-secondary">{column.type || 'Unknown'}</span>
                  </div>
                  {hasAnyIssue && (
                    <div className="text-xs font-medium leading-tight overflow-hidden mt-1">
                      <span className="text-transparent">Placeholder for alignment</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}
