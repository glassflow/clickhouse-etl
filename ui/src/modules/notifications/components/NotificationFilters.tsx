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
    <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Pipeline ID Search */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Pipeline ID</label>
          <Input
            placeholder="Search by pipeline ID..."
            value={filters.pipeline_id || ''}
            onChange={handlePipelineIdChange}
            className="h-9"
          />
        </div>

        {/* Severity Filter */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Severity</label>
          <Select
            value={filters.severity || 'all'}
            onValueChange={handleSeverityChange}
          >
            <SelectTrigger className="h-9 w-full px-3 border border-border rounded-md bg-background">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border rounded-md shadow-md">
              {SEVERITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">From Date</label>
          <Input
            type="date"
            value={filters.start_date ? filters.start_date.split('T')[0] : ''}
            onChange={handleStartDateChange}
            className="h-9"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">To Date</label>
          <Input
            type="date"
            value={filters.end_date ? filters.end_date.split('T')[0] : ''}
            onChange={handleEndDateChange}
            className="h-9"
          />
        </div>

        {/* Apply Button */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground invisible">Action</label>
          <Button onClick={handleApplyFilters} className="h-9 w-full">
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
