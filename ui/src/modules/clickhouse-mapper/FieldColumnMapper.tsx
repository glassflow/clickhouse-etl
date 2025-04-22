import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/src/components/ui/table'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { DualSearchableSelect } from '@/src/components/common/DualSearchableSelect'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { CheckIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { ColumnMappingType } from '@/src/scheme/clickhouse.scheme'
import { JSON_DATA_TYPES } from '@/src/config/constants'
import { TableColumn } from './types'
import { useState } from 'react'

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
}: FieldColumnMapperProps) {
  const [openSelectIndex, setOpenSelectIndex] = useState<number | null>(null)

  const handleSelectOpen = (index: number, isOpen: boolean) => {
    setOpenSelectIndex(isOpen ? index : null)
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-content">Map incoming event fields to ClickHouse table columns.</h3>
      </div>

      <Table className="[&_tr]:border-0 [&_td]:border-0 [&_th]:border-0 [&_thead]:border-0 [&_tbody]:border-0 border-0">
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-0">
            <TableHead className="text-content border-0">Fields in incoming event</TableHead>
            <TableHead className="text-content border-0">Data Type (incoming)</TableHead>
            <TableHead className="w-10 border-0"></TableHead>
            <TableHead className="text-content border-0">Source Topic</TableHead>
            <TableHead className="text-content border-0">Destination column</TableHead>
            <TableHead className="text-content border-0">Destination type</TableHead>
            <TableHead className="text-content border-0">Nullable</TableHead>
            <TableHead className="text-content border-0">Primary Key</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-0">
          {mappedColumns.map((column, index) => (
            <TableRow
              key={column.name}
              className="border-0 hover:bg-[var(--color-background-neutral-faded)]"
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
                  />
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={column.jsonType || ''}
                  onValueChange={(value) => updateColumnMapping(index, 'jsonType', value)}
                >
                  <SelectTrigger className="w-full bg-[var(--color-background-neutral-faded)] border-[var(--color-border-neutral)] hover:bg-[var(--color-background-neutral-faded)] transition-colors text-content select-content-custom">
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
                <ArrowRightIcon className="h-5 w-5 mx-auto text-gray-400" />
              </TableCell>
              <TableCell className="text-content">{column.sourceTopic || '-'}</TableCell>
              <TableCell className="text-content">{column.name}</TableCell>
              <TableCell className="text-content">{column.type}</TableCell>
              <TableCell className="text-center">
                {column.isNullable ? (
                  <CheckIcon className="h-5 w-5 mx-auto text-green-500" />
                ) : (
                  <XMarkIcon className="h-5 w-5 mx-auto text-red-500" />
                )}
              </TableCell>
              <TableCell className="text-center">
                {column.isKey ? (
                  <CheckIcon className="h-5 w-5 mx-auto text-green-500" />
                ) : (
                  <XMarkIcon className="h-5 w-5 mx-auto text-red-500" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
