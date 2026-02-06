'use client'

import { useMemo } from 'react'
import { SearchableCombobox } from '@/src/components/common/SearchableCombobox'

export interface FieldOption {
  name: string
  type: string
}

interface FieldSelectComboboxProps {
  value: string
  onValueChange: (value: string) => void
  availableFields: FieldOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean
  /** Filter fields by type (e.g. only string types for an arg) */
  filterTypes?: string[]
  /** Trigger class name (e.g. for width) */
  triggerClassName?: string
}

/**
 * Searchable combobox for selecting fields.
 * Displays field name and type, supports filtering by type.
 */
export function FieldSelectCombobox({
  value,
  onValueChange,
  availableFields,
  placeholder = 'Select field',
  disabled = false,
  className,
  error,
  filterTypes,
  triggerClassName,
}: FieldSelectComboboxProps) {
  // Filter by type first (transformation-specific logic)
  const filteredByType = useMemo(() => {
    if (!filterTypes?.length) return availableFields
    return availableFields.filter((f) => filterTypes.includes(f.type))
  }, [availableFields, filterTypes])

  return (
    <SearchableCombobox<FieldOption>
      value={value}
      onValueChange={onValueChange}
      options={filteredByType}
      getOptionValue={(f) => f.name}
      getOptionLabel={(f) => (
        <>
          <span>{f.name}</span>
          <span className="ml-2 text-[var(--text-secondary)]">({f.type})</span>
        </>
      )}
      getSearchableText={(f) => `${f.name} ${f.type}`}
      placeholder={placeholder}
      searchPlaceholder="Search fields..."
      emptyMessage="No field found."
      disabled={disabled}
      error={error}
      className={className}
      triggerClassName={triggerClassName}
    />
  )
}
