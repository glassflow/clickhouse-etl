'use client'

import { useCallback } from 'react'
import { Filter, X } from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { cn } from '@/src/utils/common.client'
import type { NotificationSeverity } from '@/src/services/notifications-api'

const SEVERITY_OPTIONS: { value: NotificationSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

const READ_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

/**
 * NotificationFilters Component
 *
 * Provides advanced filtering options for notifications including:
 * - Pipeline ID search
 * - Severity filter
 * - Read/unread status
 * - Date range
 */
export function NotificationFilters() {
  const { notificationsStore } = useStore()
  const { filters, setFilters, clearFilters, fetchNotifications } = notificationsStore

  const handlePipelineIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim()
      setFilters({ pipeline_id: value || undefined })
    },
    [setFilters],
  )

  const handleSeverityChange = useCallback(
    (value: string) => {
      setFilters({ severity: value === 'all' ? undefined : (value as NotificationSeverity) })
    },
    [setFilters],
  )

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setFilters({ start_date: value ? new Date(value).toISOString() : undefined })
    },
    [setFilters],
  )

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setFilters({ end_date: value ? new Date(value).toISOString() : undefined })
    },
    [setFilters],
  )

  const handleApplyFilters = useCallback(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleClearFilters = useCallback(() => {
    clearFilters()
    fetchNotifications()
  }, [clearFilters, fetchNotifications])

  const hasActiveFilters =
    filters.pipeline_id || filters.severity || filters.start_date || filters.end_date

  return (
    <div
      className={cn(
        'card-outline relative',
        'space-y-4 p-5',
        'transition-all duration-200',
        'hover:shadow-[var(--card-shadow-hover)]'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[var(--color-background-neutral-faded)]">
            <Filter className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">Filters</span>
        </div>
        <div className="flex items-center justify-end gap-2 w-full">
          <div
            className={cn(
              'space-y-1.5 flex-shrink-0 w-[100px] overflow-hidden transition-all duration-200',
              hasActiveFilters
                ? 'opacity-100 max-h-[200px] translate-y-0'
                : 'opacity-0 max-h-0 -translate-y-4 pointer-events-none'
            )}
          >
            <label className="text-xs text-[var(--text-secondary)] invisible font-medium">Clear all</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className={cn(
                'px-2 text-xs',
                'text-[var(--text-secondary)] hover:text-[var(--text-secondary-faded)]',
                'transition-colors duration-200',
                'btn-secondary',
                'w-full'
              )}
            >
              Clear all
            </Button>
          </div>
          <div
            className={cn(
              'space-y-1.5 flex-shrink-0 w-[100px] overflow-hidden transition-all duration-200',
              hasActiveFilters
                ? 'opacity-100 max-h-[200px] translate-y-0'
                : 'opacity-0 max-h-0 -translate-y-4 pointer-events-none'
            )}
          >
            <label className="text-xs text-[var(--text-secondary)] invisible font-medium">Apply</label>
            <Button
              onClick={handleApplyFilters}
              className={cn(
                'px-2 text-xs',
                'text-[var(--text-primary)] hover:text-[var(--text-primary-faded)]',
                'transition-all duration-200',
                'btn-primary',
                'w-full'
              )}
            >
              Apply
            </Button>
          </div>
        </div>

      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 w-full">
          {/* Pipeline ID Search */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)] font-medium">Pipeline ID</label>
            <Input
              placeholder="Search by pipeline ID..."
              value={filters.pipeline_id || ''}
              onChange={handlePipelineIdChange}
              className={cn(
                'h-9',
                'bg-[var(--control-bg)] border-[var(--control-border)]',
                'hover:border-[var(--control-border-hover)]',
                'focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Severity Filter */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)] font-medium">Severity</label>
            <Select
              value={filters.severity || 'all'}
              onValueChange={handleSeverityChange}
            >
              <SelectTrigger
                className={cn(
                  'h-9 w-full px-3 rounded-[var(--radius-medium)]',
                  'bg-[var(--control-bg)] border border-[var(--control-border)]',
                  'hover:border-[var(--control-border-hover)] hover:bg-[var(--control-bg-hover)]',
                  'transition-all duration-200'
                )}
              >
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent
                className={cn(
                  'bg-[var(--select-content-background-color)] border border-[var(--select-content-border-color)]',
                  'rounded-[var(--radius-medium)] shadow-[var(--select-content-shadow)]'
                )}
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-[var(--text-primary)] hover:bg-[var(--option-bg-hover)]"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)] font-medium">From Date</label>
            <Input
              type="date"
              value={filters.start_date ? filters.start_date.split('T')[0] : ''}
              onChange={handleStartDateChange}
              className={cn(
                'h-9',
                'bg-[var(--control-bg)] border-[var(--control-border)]',
                'hover:border-[var(--control-border-hover)]',
                'focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* End Date */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)] font-medium">To Date</label>
            <Input
              type="date"
              value={filters.end_date ? filters.end_date.split('T')[0] : ''}
              onChange={handleEndDateChange}
              className={cn(
                'h-9',
                'bg-[var(--control-bg)] border-[var(--control-border)]',
                'hover:border-[var(--control-border-hover)]',
                'focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]',
                'transition-all duration-200'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
