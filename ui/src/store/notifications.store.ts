import { StateCreator } from 'zustand'
import {
  Notification,
  NotificationFilters,
  NotificationListResponse,
  notificationsApi,
} from '@/src/services/notifications-api'

// ============================================================================
// Types
// ============================================================================

export interface NotificationsStoreProps {
  // Notifications data
  notifications: Notification[]
  totalCount: number
  unreadCount: number

  // Loading and error states
  isLoading: boolean
  error: string | null

  // Filters and pagination
  filters: NotificationFilters
  currentPage: number
  pageSize: number

  // Selection state for bulk operations
  selectedIds: Set<string>

  // Panel state
  isPanelOpen: boolean

  // Polling state
  lastFetchedAt: number | null
  pollingInterval: number // in milliseconds
}

export interface NotificationsStore extends NotificationsStoreProps {
  // Data fetching
  fetchNotifications: () => Promise<void>
  refreshNotifications: () => Promise<void>

  // Single notification operations
  markAsRead: (notificationId: string) => Promise<boolean>
  deleteNotification: (notificationId: string) => Promise<boolean>

  // Bulk operations
  markSelectedAsRead: () => Promise<boolean>
  deleteSelected: () => Promise<boolean>

  // Selection management
  selectNotification: (notificationId: string) => void
  deselectNotification: (notificationId: string) => void
  selectAll: () => void
  deselectAll: () => void
  toggleSelection: (notificationId: string) => void

  // Filter management
  setFilters: (filters: Partial<NotificationFilters>) => void
  clearFilters: () => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void

  // Panel management
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  // Polling management
  setPollingInterval: (interval: number) => void

  // Reset
  resetNotificationsStore: () => void
}

export interface NotificationsSlice {
  notificationsStore: NotificationsStore
}

// ============================================================================
// Initial State
// ============================================================================

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_POLLING_INTERVAL = 30000 // 30 seconds

export const initialNotificationsStore: NotificationsStoreProps = {
  notifications: [],
  totalCount: 0,
  unreadCount: 0,
  isLoading: false,
  error: null,
  filters: {},
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  selectedIds: new Set<string>(),
  isPanelOpen: false,
  lastFetchedAt: null,
  pollingInterval: DEFAULT_POLLING_INTERVAL,
}

// ============================================================================
// Store Slice
// ============================================================================

export const createNotificationsSlice: StateCreator<NotificationsSlice> = (set, get) => ({
  notificationsStore: {
    ...initialNotificationsStore,

    // --------------------------------------------------------------------------
    // Data Fetching
    // --------------------------------------------------------------------------

    fetchNotifications: async () => {
      const { filters, currentPage, pageSize } = get().notificationsStore

      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          isLoading: true,
          error: null,
        },
      }))

      const result = await notificationsApi.fetchNotifications({
        ...filters,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      })

      if (result.success && result.data) {
        const unreadCount = result.data.notifications.filter((n) => !n.read).length

        set((state) => ({
          notificationsStore: {
            ...state.notificationsStore,
            notifications: result.data!.notifications,
            totalCount: result.data!.pagination.total,
            unreadCount,
            isLoading: false,
            lastFetchedAt: Date.now(),
          },
        }))
      } else {
        set((state) => ({
          notificationsStore: {
            ...state.notificationsStore,
            isLoading: false,
            error: result.error || 'Failed to fetch notifications',
          },
        }))
      }
    },

    refreshNotifications: async () => {
      // Same as fetchNotifications but doesn't show loading state
      const { filters, currentPage, pageSize } = get().notificationsStore

      const result = await notificationsApi.fetchNotifications({
        ...filters,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      })

      if (result.success && result.data) {
        const unreadCount = result.data.notifications.filter((n) => !n.read).length

        set((state) => ({
          notificationsStore: {
            ...state.notificationsStore,
            notifications: result.data!.notifications,
            totalCount: result.data!.pagination.total,
            unreadCount,
            lastFetchedAt: Date.now(),
          },
        }))
      }
    },

    // --------------------------------------------------------------------------
    // Single Notification Operations
    // --------------------------------------------------------------------------

    markAsRead: async (notificationId: string) => {
      const result = await notificationsApi.markAsRead(notificationId)

      if (result.success) {
        set((state) => ({
          notificationsStore: {
            ...state.notificationsStore,
            notifications: state.notificationsStore.notifications.map((n) =>
              n.notification_id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n,
            ),
            unreadCount: Math.max(0, state.notificationsStore.unreadCount - 1),
          },
        }))
        return true
      }
      return false
    },

    deleteNotification: async (notificationId: string) => {
      const result = await notificationsApi.deleteNotification(notificationId)

      if (result.success) {
        set((state) => {
          const notification = state.notificationsStore.notifications.find(
            (n) => n.notification_id === notificationId,
          )
          const wasUnread = notification && !notification.read

          return {
            notificationsStore: {
              ...state.notificationsStore,
              notifications: state.notificationsStore.notifications.filter(
                (n) => n.notification_id !== notificationId,
              ),
              totalCount: state.notificationsStore.totalCount - 1,
              unreadCount: wasUnread
                ? Math.max(0, state.notificationsStore.unreadCount - 1)
                : state.notificationsStore.unreadCount,
              selectedIds: new Set(
                [...state.notificationsStore.selectedIds].filter((id) => id !== notificationId),
              ),
            },
          }
        })
        return true
      }
      return false
    },

    // --------------------------------------------------------------------------
    // Bulk Operations
    // --------------------------------------------------------------------------

    markSelectedAsRead: async () => {
      const { selectedIds, notifications } = get().notificationsStore
      const idsToMark = [...selectedIds]

      if (idsToMark.length === 0) return false

      const result = await notificationsApi.markAsReadBulk(idsToMark)

      if (result.success) {
        const markedIds = new Set(idsToMark.filter((id) => !result.data?.not_found?.includes(id)))

        set((state) => {
          const unreadMarked = state.notificationsStore.notifications.filter(
            (n) => markedIds.has(n.notification_id) && !n.read,
          ).length

          return {
            notificationsStore: {
              ...state.notificationsStore,
              notifications: state.notificationsStore.notifications.map((n) =>
                markedIds.has(n.notification_id) ? { ...n, read: true, read_at: new Date().toISOString() } : n,
              ),
              unreadCount: Math.max(0, state.notificationsStore.unreadCount - unreadMarked),
              selectedIds: new Set<string>(),
            },
          }
        })
        return true
      }
      return false
    },

    deleteSelected: async () => {
      const { selectedIds } = get().notificationsStore
      const idsToDelete = [...selectedIds]

      if (idsToDelete.length === 0) return false

      const result = await notificationsApi.deleteNotificationsBulk(idsToDelete)

      if (result.success) {
        const deletedIds = new Set(idsToDelete.filter((id) => !result.data?.not_found?.includes(id)))

        set((state) => {
          const unreadDeleted = state.notificationsStore.notifications.filter(
            (n) => deletedIds.has(n.notification_id) && !n.read,
          ).length

          return {
            notificationsStore: {
              ...state.notificationsStore,
              notifications: state.notificationsStore.notifications.filter(
                (n) => !deletedIds.has(n.notification_id),
              ),
              totalCount: state.notificationsStore.totalCount - deletedIds.size,
              unreadCount: Math.max(0, state.notificationsStore.unreadCount - unreadDeleted),
              selectedIds: new Set<string>(),
            },
          }
        })
        return true
      }
      return false
    },

    // --------------------------------------------------------------------------
    // Selection Management
    // --------------------------------------------------------------------------

    selectNotification: (notificationId: string) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          selectedIds: new Set([...state.notificationsStore.selectedIds, notificationId]),
        },
      }))
    },

    deselectNotification: (notificationId: string) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          selectedIds: new Set([...state.notificationsStore.selectedIds].filter((id) => id !== notificationId)),
        },
      }))
    },

    selectAll: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          selectedIds: new Set(state.notificationsStore.notifications.map((n) => n.notification_id)),
        },
      }))
    },

    deselectAll: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          selectedIds: new Set<string>(),
        },
      }))
    },

    toggleSelection: (notificationId: string) => {
      set((state) => {
        const newSelectedIds = new Set(state.notificationsStore.selectedIds)
        if (newSelectedIds.has(notificationId)) {
          newSelectedIds.delete(notificationId)
        } else {
          newSelectedIds.add(notificationId)
        }
        return {
          notificationsStore: {
            ...state.notificationsStore,
            selectedIds: newSelectedIds,
          },
        }
      })
    },

    // --------------------------------------------------------------------------
    // Filter Management
    // --------------------------------------------------------------------------

    setFilters: (filters: Partial<NotificationFilters>) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          filters: { ...state.notificationsStore.filters, ...filters },
          currentPage: 1, // Reset to first page when filters change
        },
      }))
    },

    clearFilters: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          filters: {},
          currentPage: 1,
        },
      }))
    },

    setPage: (page: number) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          currentPage: page,
        },
      }))
    },

    setPageSize: (size: number) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          pageSize: size,
          currentPage: 1, // Reset to first page when page size changes
        },
      }))
    },

    // --------------------------------------------------------------------------
    // Panel Management
    // --------------------------------------------------------------------------

    openPanel: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          isPanelOpen: true,
        },
      }))
    },

    closePanel: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          isPanelOpen: false,
        },
      }))
    },

    togglePanel: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          isPanelOpen: !state.notificationsStore.isPanelOpen,
        },
      }))
    },

    // --------------------------------------------------------------------------
    // Polling Management
    // --------------------------------------------------------------------------

    setPollingInterval: (interval: number) => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          pollingInterval: interval,
        },
      }))
    },

    // --------------------------------------------------------------------------
    // Reset
    // --------------------------------------------------------------------------

    resetNotificationsStore: () => {
      set((state) => ({
        notificationsStore: {
          ...state.notificationsStore,
          ...initialNotificationsStore,
        },
      }))
    },
  },
})
