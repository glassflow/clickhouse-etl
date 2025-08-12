'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export function SearchableKeySelect({
  availableKeys,
  onSelect,
  onRemove,
  placeholder = 'Select a key',
  index,
  className,
}: {
  availableKeys: string[]
  onSelect: (key: string, index: number) => void
  onRemove: (index: number) => void
  placeholder?: string
  index: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredKeys = availableKeys.filter((key) => key.toLowerCase().includes(search.toLowerCase()))

  // Handle clicks outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          className="w-full pr-10 input-regular input-border-regular"
        />
        <ChevronDownIcon
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 cursor-pointer"
          onClick={() => setOpen(!open)}
        />

        {open && (
          <div
            ref={dropdownRef}
            className="absolute bg-[#1e1e1f] top-full left-0 z-10 w-full bg-popover shadow-md rounded-md mt-1 border border-border overflow-hidden select-content-custom"
          >
            <div className="max-h-[200px] overflow-auto p-1">
              {filteredKeys.length === 0 ? (
                <div className="py-2 px-2 text-sm text-muted-foreground">No keys found.</div>
              ) : (
                <div className="space-y-1">
                  {filteredKeys.map((key) => (
                    <button
                      key={key}
                      className={cn(
                        'flex w-full items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                        'focus:bg-accent focus:text-accent-foreground',
                      )}
                      onClick={() => {
                        onSelect(key, index)
                        setOpen(false)
                        setSearch(key) // Set the search to the selected key
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="h-8 w-8">
        <TrashIcon className="h-4 w-4" />
      </Button> */}
    </div>
  )
}
