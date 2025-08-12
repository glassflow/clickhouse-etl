'use client'

import { useEffect } from 'react'
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/src/components/ui/table'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { DualSearchableSelect } from '@/src/components/common/DualSearchableSelect'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { CheckIcon, XMarkIcon, ArrowRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ColumnMappingType } from '@/src/scheme/clickhouse.scheme'
import { JSON_DATA_TYPES } from '@/src/config/constants'
import { TableColumn } from '../types'
import { useState } from 'react'
import { isTypeCompatible } from '../utils'
import Image from 'next/image'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

// Import topic icons
import deduplicateIcon from '@/src/images/deduplicate.svg'
import leftTopicIcon from '@/src/images/left-topic.svg'
import rightTopicIcon from '@/src/images/right-topic.svg'

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
}: FieldColumnMapperProps) {
  const [openSelectIndex, setOpenSelectIndex] = useState<number | null>(null)
  const analytics = useJourneyAnalytics()
  const handleSelectOpen = (index: number, isOpen: boolean) => {
    setOpenSelectIndex(isOpen ? index : null)
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
        return (
          <div className="flex justify-center">
            <Image src={leftTopicIcon} alt="Primary Topic" height={20} width={20} />
          </div>
        )
      } else if (column.sourceTopic === secondaryTopicName) {
        return (
          <div className="flex justify-center">
            <Image src={rightTopicIcon} alt="Secondary Topic" height={20} width={20} />
          </div>
        )
      }
    }

    // Default icon for deduplication or when no source is available
    return (
      <div className="flex justify-center">
        <Image src={leftTopicIcon} alt="Topic" height={20} width={20} />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-12">
        <h3 className="text-lg font-medium text-content">
          Map incoming event fields to ClickHouse table columns.
          {readOnly && <span className="text-sm text-gray-500 ml-2">(Read-only)</span>}
        </h3>
        {/* TypeCompatibilityInfo is temporarily hidden */}
        {/* <TypeCompatibilityInfo /> */}
      </div>

      <Table
        className={`[&_tr]:border-0 [&_td]:border-0 [&_th]:border-0 [&_thead]:border-0 [&_tbody]:border-0 border-0 ${readOnly ? 'opacity-75' : ''}`}
      >
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-0">
            <TableHead className="text-content border-0">Fields in incoming event</TableHead>
            <TableHead className="text-content border-0">Data Type (incoming)</TableHead>
            <TableHead className="w-10 border-0 text-content">Status</TableHead>
            <TableHead className="text-content border-0">Topic</TableHead>
            <TableHead className="text-content border-0">Destination column</TableHead>
            <TableHead className="text-content border-0">Destination type</TableHead>
            <TableHead className="text-content border-0">Nullable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-0">
          {mappedColumns.map((column, index) => {
            return (
              <TableRow
                key={column.name}
                className={`border-0 ${!readOnly ? 'hover:bg-[var(--color-background-neutral-faded)]' : ''}`}
                style={{
                  transition: 'background-color 0.2s ease-in-out',
                }}
              >
                <TableCell>
                  {isJoinMapping ? (
                    <DualSearchableSelect
                      primaryOptions={primaryEventFields}
                      secondaryOptions={secondaryEventFields}
                      selectedOption={column.eventField}
                      onSelect={(option, source) => mapEventFieldToColumn(index, option || '', source)}
                      placeholder="Select event field"
                      className="w-full"
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
                      open={openSelectIndex === index}
                      onOpenChange={(isOpen) => handleSelectOpen(index, isOpen)}
                      disabled={readOnly}
                      readOnly={readOnly}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={column.jsonType || ''}
                    onValueChange={(value) => updateColumnMapping(index, 'jsonType', value)}
                    disabled={readOnly}
                  >
                    <SelectTrigger
                      className={`w-full bg-[var(--color-background-neutral-faded)] border-[var(--color-border-neutral)] hover:bg-[var(--color-background-neutral-faded)] transition-colors text-content select-content-custom ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                </TableCell>
                <TableCell className="text-center">
                  {column.eventField && column.jsonType ? (
                    isTypeCompatible(column.jsonType, column.type) ? (
                      <CheckIcon className="h-5 w-5 mx-auto text-green-500" />
                    ) : (
                      <ExclamationTriangleIcon
                        className="h-5 w-5 mx-auto text-red-500"
                        title={`Type ${column.jsonType} is not compatible with ClickHouse type ${column.type || 'unknown'}`}
                      />
                    )
                  ) : (
                    <ArrowRightIcon className="h-5 w-5 mx-auto text-gray-400" />
                  )}
                </TableCell>
                <TableCell className="text-content flex justify-start items-center pt-4 pl-4">
                  {renderSourceTopicIcon(column)}
                </TableCell>
                <TableCell className="text-content">{column.name}</TableCell>
                <TableCell className="text-content">{column.type || 'Unknown'}</TableCell>
                <TableCell className="text-center">
                  {column.isNullable ? (
                    <CheckIcon className="h-5 w-5 mx-auto text-green-500" />
                  ) : (
                    <XMarkIcon className="h-5 w-5 mx-auto text-red-500" />
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
