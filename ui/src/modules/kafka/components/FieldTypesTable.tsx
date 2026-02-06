'use client'

import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/src/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { FieldTypeInfo } from '@/src/modules/kafka/types'

export interface FieldTypesTableProps {
  fieldTypes: FieldTypeInfo[]
  readOnly: boolean
  dataTypes: readonly string[]
  onTypeChange: (fieldName: string, newType: string) => void
  onRemoveField: (fieldName: string) => void
  onRestoreField: (fieldName: string) => void
  newFieldName: string
  newFieldType: string
  newFieldError: string | null
  onNewFieldNameChange: (value: string) => void
  onNewFieldTypeChange: (value: string) => void
  onNewFieldErrorClear: () => void
  onAddField: () => void
}

export function FieldTypesTable({
  fieldTypes,
  readOnly,
  dataTypes,
  onTypeChange,
  onRemoveField,
  onRestoreField,
  newFieldName,
  newFieldType,
  newFieldError,
  onNewFieldNameChange,
  onNewFieldTypeChange,
  onNewFieldErrorClear,
  onAddField,
}: FieldTypesTableProps) {
  return (
    <div className="flex-[2] min-w-0">
      <Label className="text-lg font-medium text-content mb-4 block">Field Types</Label>

      <div className="p-6 rounded-[var(--radius-large)] overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-0">
              <TableHead className="text-content font-medium py-3 px-4 w-[40%]">Field Name</TableHead>
              <TableHead className="text-content font-medium py-3 px-4 w-[20%]">Inferred Type</TableHead>
              <TableHead className="text-content font-medium py-3 px-4 w-[25%]">Data Type</TableHead>
              {!readOnly && (
                <TableHead className="text-content font-medium py-3 px-4 w-[15%] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldTypes.map((field) => (
              <TableRow
                key={field.name}
                className={`border-0 ${field.isRemoved ? 'opacity-50' : ''} ${
                  field.isManuallyAdded && !field.isRemoved
                    ? 'bg-[var(--color-background-primary-faded)]'
                    : 'bg-[var(--surface-bg-sunken)]'
                } ${!readOnly && !field.isRemoved ? 'hover:bg-[var(--color-background-neutral-faded)]' : ''}`}
                style={{ transition: 'background-color 0.2s ease-in-out, opacity 0.2s ease-in-out' }}
              >
                <TableCell
                  className={`py-3 px-4 font-mono text-sm text-content ${field.isRemoved ? 'line-through' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    {field.name}
                    {field.isManuallyAdded && !field.isRemoved && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]">
                        Added
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell
                  className={`py-3 px-4 text-sm text-[var(--text-secondary)] ${field.isRemoved ? 'line-through' : ''}`}
                >
                  {field.inferredType}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <Select
                    value={field.userType}
                    onValueChange={(value) => onTypeChange(field.name, value)}
                    disabled={readOnly || field.isRemoved}
                  >
                    <SelectTrigger
                      className={`w-full input-regular input-border-regular ${
                        field.userType !== field.inferredType && field.inferredType !== '-'
                          ? 'border-[var(--color-border-primary)]'
                          : ''
                      } ${readOnly || field.isRemoved ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="select-content-custom">
                      {dataTypes.map((type) => (
                        <SelectItem key={type} value={type} className="select-item-custom">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {!readOnly && (
                  <TableCell className="py-3 px-4 text-right">
                    {field.isRemoved ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRestoreField(field.name)}
                        className="text-[var(--color-foreground-primary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)]"
                        title="Restore field"
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveField(field.name)}
                        className="text-[var(--color-foreground-negative)] hover:text-[var(--color-foreground-negative)] hover:bg-[var(--color-background-negative-faded)]"
                        title="Remove field"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {!readOnly && (
              <TableRow className="border-0 bg-[var(--surface-bg-sunken)]">
                <TableCell className="py-3 px-4">
                  <Input
                    value={newFieldName}
                    onChange={(e) => {
                      onNewFieldNameChange(e.target.value)
                      onNewFieldErrorClear()
                    }}
                    placeholder="Enter field name..."
                    className={`input-regular input-border-regular font-mono text-sm ${
                      newFieldError ? 'border-[var(--color-border-negative)]' : ''
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFieldName.trim()) {
                        onAddField()
                      }
                    }}
                  />
                  {newFieldError && (
                    <div className="text-xs text-[var(--color-foreground-negative)] mt-1">{newFieldError}</div>
                  )}
                </TableCell>
                <TableCell className="py-3 px-4 text-sm text-[var(--text-secondary)]">-</TableCell>
                <TableCell className="py-3 px-4">
                  <Select value={newFieldType} onValueChange={onNewFieldTypeChange}>
                    <SelectTrigger className="w-full input-regular input-border-regular">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="select-content-custom">
                      {dataTypes.map((type) => (
                        <SelectItem key={type} value={type} className="select-item-custom">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3 px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAddField}
                    disabled={!newFieldName.trim()}
                    className="text-[var(--color-foreground-primary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)] disabled:opacity-50"
                    title="Add field"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {fieldTypes.some((f) => f.userType !== f.inferredType && f.inferredType !== '-' && !f.isRemoved) && (
          <div className="text-sm text-[var(--color-foreground-primary)]">
            Some types have been modified from their inferred values.
          </div>
        )}
        {fieldTypes.some((f) => f.isManuallyAdded && !f.isRemoved) && (
          <div className="text-sm text-[var(--color-foreground-primary)]">
            {fieldTypes.filter((f) => f.isManuallyAdded && !f.isRemoved).length} custom field(s) added.
          </div>
        )}
        {fieldTypes.some((f) => f.isRemoved) && (
          <div className="text-sm text-[var(--color-foreground-negative)]">
            {fieldTypes.filter((f) => f.isRemoved).length} field(s) marked for removal.
          </div>
        )}
      </div>
    </div>
  )
}
