'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { FilterIcon } from '@/src/components/icons'
import { FilterChip } from '../FilterChip'
import type { FilterState } from '../utils/filterUrl'

type DensityMode = 'table' | 'hybrid' | 'cards'

interface PipelinesToolbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  availableTags: string[]
  densityMode: DensityMode
  onDensityChange: (mode: DensityMode) => void
  filterButtonRef: React.RefObject<HTMLButtonElement>
  isFilterMenuOpen: boolean
  onFilterMenuToggle: () => void
}

export function PipelinesToolbar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  densityMode,
  onDensityChange,
  filterButtonRef,
  onFilterMenuToggle,
}: PipelinesToolbarProps) {
  const hasActiveFilters =
    filters.status.length > 0 || filters.health.length > 0 || filters.tags.length > 0

  return (
    <div className="flex items-center gap-3 w-full flex-wrap">
      {/* Search */}
      <div className="relative flex-grow min-w-[200px] max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-foreground-neutral-faded)] pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search pipelines…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral)] placeholder:text-[var(--control-fg-placeholder)] focus:outline-none focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
        />
      </div>

      {/* Filter button */}
      <button
        ref={filterButtonRef}
        onClick={onFilterMenuToggle}
        className="p-2 hover:opacity-70 rounded-lg transition-opacity duration-200 relative"
        aria-label="Filter pipelines"
      >
        <FilterIcon size={20} className="text-[var(--color-foreground-neutral-faded)]" />
        {hasActiveFilters && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{
              background:
                'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))',
            }}
          />
        )}
      </button>

      {/* Active filter chips */}
      {filters.status.length > 0 && (
        <FilterChip
          label="Status"
          values={filters.status.map((s) => s.charAt(0).toUpperCase() + s.slice(1))}
          onRemove={() => onFiltersChange({ ...filters, status: [] })}
          onClick={onFilterMenuToggle}
        />
      )}
      {filters.health.length > 0 && (
        <FilterChip
          label="Health"
          values={filters.health.map((h) => h.charAt(0).toUpperCase() + h.slice(1))}
          onRemove={() => onFiltersChange({ ...filters, health: [] })}
          onClick={onFilterMenuToggle}
        />
      )}
      {filters.tags.length > 0 && (
        <FilterChip
          label="Tags"
          values={filters.tags}
          onRemove={() => onFiltersChange({ ...filters, tags: [] })}
          onClick={onFilterMenuToggle}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Density toggle */}
      <div className="flex items-center gap-1 rounded-lg p-1 bg-[var(--surface-bg)] border border-[var(--surface-border)]">
        {(['table', 'hybrid', 'cards'] as DensityMode[]).map((mode) => (
          <button
            key={mode}
            title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
            onClick={() => onDensityChange(mode)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              densityMode === mode
                ? 'bg-[var(--color-foreground-primary)] text-[var(--button-primary-text)]'
                : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]'
            }`}
          >
            {mode.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
