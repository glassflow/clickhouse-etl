'use client'

import React, { useRef, useEffect } from 'react'
import { cn } from '@/src/utils/common.client'
import { PipelineStatus } from '@/src/types/pipeline'
import type { FilterState } from './utils/filterUrl'

export type { FilterState } from './utils/filterUrl'

interface PipelineFilterMenuProps {
  isOpen: boolean
  onClose: () => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  anchorEl?: HTMLElement | null
  availableTags?: string[]
}

export function PipelineFilterMenu({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  anchorEl,
  availableTags = [],
}: PipelineFilterMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorEl])

  if (!isOpen) return null

  const availableStatuses: PipelineStatus[] = ['active', 'paused', 'stopped', 'failed']
  const availableHealthOptions: ('stable' | 'unstable')[] = ['stable', 'unstable']

  const handleStatusChange = (status: PipelineStatus) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]

    onFiltersChange({ ...filters, status: newStatuses })
  }

  const handleHealthChange = (health: 'stable' | 'unstable') => {
    const newHealth = filters.health.includes(health)
      ? filters.health.filter((h) => h !== health)
      : [...filters.health, health]

    onFiltersChange({ ...filters, health: newHealth })
  }

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag]
    onFiltersChange({ ...filters, tags: newTags })
  }

  const getStatusLabel = (status: PipelineStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getHealthLabel = (health: 'stable' | 'unstable') => {
    return health.charAt(0).toUpperCase() + health.slice(1)
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-64 rounded-lg shadow-lg"
      style={{
        top: anchorEl ? `${anchorEl.getBoundingClientRect().bottom + 4}px` : undefined,
        left: anchorEl ? `${anchorEl.getBoundingClientRect().left}px` : undefined,
        backgroundColor: 'var(--color-background-elevation-raised-faded-2)',
      }}
    >
      <div className="p-4 space-y-4">
        {/* Status Section */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground-neutral)' }}>
            Status
          </h3>
          <div className="space-y-2">
            {availableStatuses.map((status) => (
              <label
                key={status}
                className="flex items-center gap-3 cursor-pointer p-2 rounded transition-all duration-200 hover:opacity-80"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={() => handleStatusChange(status)}
                    className="peer sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center"
                    style={{
                      borderColor: filters.status.includes(status) ? 'transparent' : 'var(--color-border-regular)',
                      background: filters.status.includes(status)
                        ? 'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))'
                        : 'transparent',
                    }}
                  >
                    {filters.status.includes(status) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm" style={{ color: 'var(--color-foreground-neutral)' }}>
                  {getStatusLabel(status)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--color-foreground-neutral-faded)' }} />

        {/* Health Section */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground-neutral)' }}>
            Health
          </h3>
          <div className="space-y-2">
            {availableHealthOptions.map((health) => (
              <label
                key={health}
                className="flex items-center gap-3 cursor-pointer p-2 rounded transition-all duration-200 hover:opacity-80"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={filters.health.includes(health)}
                    onChange={() => handleHealthChange(health)}
                    className="peer sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center"
                    style={{
                      borderColor: filters.health.includes(health) ? 'transparent' : 'var(--color-border-regular)',
                      background: filters.health.includes(health)
                        ? 'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))'
                        : 'transparent',
                    }}
                  >
                    {filters.health.includes(health) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm" style={{ color: 'var(--color-foreground-neutral)' }}>
                  {getHealthLabel(health)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      {availableTags.length > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--color-foreground-neutral-faded)' }} />
      )}

      {availableTags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground-neutral)' }}>
            Tags
          </h3>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-auto pr-1">
            {availableTags.map((tag) => {
              const isSelected = filters.tags.includes(tag)
              return (
                <button
                  key={tag}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-all border',
                    isSelected
                      ? 'text-[var(--color-background-regular)] border-transparent'
                      : 'text-[var(--color-foreground-neutral)] border-[var(--color-border-neutral)]',
                  )}
                  style={{
                    background: isSelected
                      ? 'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))'
                      : 'var(--color-background-elevation-raised-faded)',
                  }}
                  onClick={() => handleTagToggle(tag)}
                  type="button"
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
