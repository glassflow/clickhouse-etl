'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/src/store'

interface UseNotificationsOptions {
  /**
   * Whether polling should be enabled.
   * Set to false when the feature is disabled.
   */
  enabled?: boolean

  /**
   * Custom polling interval in milliseconds.
   * If not provided, uses the value from the store (default: 30000ms).
   */
  pollingInterval?: number

  /**
   * Whether to fetch immediately on mount.
   * @default true
   */
  fetchOnMount?: boolean
}

/**
 * useNotifications Hook
 *
 * Provides notification data management with automatic polling.
 * Handles fetching notifications at regular intervals to keep
 * the unread count and notification list up to date.
 *
 * @example
 * ```tsx
 * // Basic usage - enable polling
 * useNotifications({ enabled: true })
 *
 * // With custom polling interval
 * useNotifications({ enabled: true, pollingInterval: 60000 })
 *
 * // Access notification data
 * const { notificationsStore } = useStore()
 * const { notifications, unreadCount, isLoading } = notificationsStore
 * ```
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, pollingInterval: customInterval, fetchOnMount = true } = options

  const { notificationsStore } = useStore()
  const {
    fetchNotifications,
    refreshNotifications,
    pollingInterval: storeInterval,
    lastFetchedAt,
  } = notificationsStore

  // Use custom interval if provided, otherwise use store value
  const pollingInterval = customInterval ?? storeInterval

  // Track if this is the initial mount
  const isInitialMount = useRef(true)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup polling timer
  const clearPollingTimer = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    if (!enabled || !fetchOnMount) {
      return
    }

    if (isInitialMount.current) {
      isInitialMount.current = false
      fetchNotifications()
    }
  }, [enabled, fetchOnMount, fetchNotifications])

  // Setup polling
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) {
      clearPollingTimer()
      return
    }

    // Clear any existing timer
    clearPollingTimer()

    // Start new polling timer
    pollingTimerRef.current = setInterval(() => {
      // Use refreshNotifications for silent updates (no loading state)
      refreshNotifications()
    }, pollingInterval)

    // Cleanup on unmount or when dependencies change
    return () => {
      clearPollingTimer()
    }
  }, [enabled, pollingInterval, refreshNotifications, clearPollingTimer])

  // Handle visibility change - refresh when tab becomes visible
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if enough time has passed since last fetch
        const now = Date.now()
        const timeSinceLastFetch = lastFetchedAt ? now - lastFetchedAt : Infinity

        // If more than half the polling interval has passed, refresh
        if (timeSinceLastFetch > pollingInterval / 2) {
          refreshNotifications()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, pollingInterval, lastFetchedAt, refreshNotifications])

  // Return store methods for convenience
  return {
    fetchNotifications,
    refreshNotifications,
    notifications: notificationsStore.notifications,
    unreadCount: notificationsStore.unreadCount,
    isLoading: notificationsStore.isLoading,
    error: notificationsStore.error,
  }
}
