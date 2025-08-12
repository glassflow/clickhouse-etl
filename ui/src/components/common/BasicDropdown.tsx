import { useState, useEffect, useRef } from 'react'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'

type BasicDropdownProps = {
  label: string
  defaultValue: string
  onSelect: (option: string) => void
  isLoading: boolean
  error: string
  optionsList: string[]
  placeholder: string
}

export const BasicDropdown = ({
  label,
  defaultValue,
  onSelect,
  isLoading,
  error,
  optionsList,
  placeholder,
}: BasicDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(defaultValue || '')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Update selectedValue when defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setSelectedValue(defaultValue)
    }
  }, [defaultValue])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (option: string) => {
    setSelectedValue(option)
    onSelect(option)
    setIsOpen(false)
  }

  return (
    <div className="space-y-2 w-full min-w-[200px]" ref={dropdownRef}>
      <Label htmlFor="topic-select">{label}</Label>
      <div className="relative">
        <button
          type="button"
          className={cn(
            'w-full p-2 text-left rounded-md border',
            'input-regular',
            'input-border-regular',
            error && 'input-border-error',
            isOpen && 'card-gradient-active',
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedValue || placeholder}
        </button>
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
            {error ? (
              <div className="p-2 text-red-500">{error}</div>
            ) : isLoading ? (
              <div className="p-2">Loading options...</div>
            ) : !optionsList || optionsList.length === 0 ? (
              <div className="p-2">No options found</div>
            ) : (
              <>
                {optionsList.map((option: string, index: number) => (
                  <div
                    key={`${option}-${index}`}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelect(option)}
                  >
                    {option}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {error && <p className="input-description-error text-sm">{error}</p>}
    </div>
  )
}
