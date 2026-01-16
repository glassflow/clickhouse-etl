/**
 * Centralized Mock Notifications State Management
 *
 * Provides persistent state management for mock notifications across API requests.
 * This allows us to simulate realistic notification operations (mark read, delete)
 * without needing a real notification service.
 */

import {
  mockNotifications as initialNotifications,
  mockChannels as initialChannels,
  mockSeverityMappings as initialMappings,
  generateMockNotification,
  type Notification,
  type Channel,
  type SeverityMapping,
} from './notifications'
import type {
  NotificationSeverity,
  EventType,
  ChannelType,
  SeverityLevel,
} from '@/src/services/notifications-api'

// In-memory stores
let notifications: Notification[] = [...initialNotifications]
let channels: Channel[] = [...initialChannels]
let severityMappings: SeverityMapping[] = [...initialMappings]

// ============================================================================
// Notifications State
// ============================================================================

/**
 * Initialize notifications state (resets to initial data)
 */
export const initializeNotificationsState = (): void => {
  notifications = [...initialNotifications]
}

/**
 * Get all notifications (excluding soft-deleted unless requested)
 */
export const getNotifications = (includeDeleted: boolean = false): Notification[] => {
  if (includeDeleted) {
    return [...notifications]
  }
  return notifications.filter((n) => !n.deleted)
}

/**
 * Get a single notification by ID
 */
export const getNotification = (notificationId: string): Notification | undefined => {
  return notifications.find((n) => n.notification_id === notificationId)
}

/**
 * Get notifications with filters and pagination
 */
export const getNotificationsFiltered = (
  filters: {
    pipeline_id?: string
    severity?: NotificationSeverity
    start_date?: string
    end_date?: string
    include_deleted?: boolean
  },
  pagination: { limit: number; offset: number },
): { notifications: Notification[]; total: number } => {
  let filtered = getNotifications(filters.include_deleted)

  // Apply filters
  if (filters.pipeline_id) {
    filtered = filtered.filter((n) => n.pipeline_id === filters.pipeline_id)
  }
  if (filters.severity) {
    filtered = filtered.filter((n) => n.severity === filters.severity)
  }
  if (filters.start_date) {
    const startDate = new Date(filters.start_date)
    filtered = filtered.filter((n) => new Date(n.timestamp) >= startDate)
  }
  if (filters.end_date) {
    const endDate = new Date(filters.end_date)
    filtered = filtered.filter((n) => new Date(n.timestamp) <= endDate)
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const total = filtered.length

  // Apply pagination
  const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit)

  return { notifications: paginated, total }
}

/**
 * Get unread count
 */
export const getUnreadCount = (): number => {
  return notifications.filter((n) => !n.deleted && !n.read).length
}

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = (
  notificationId: string,
): { success: boolean; notification?: Notification; error?: string } => {
  const index = notifications.findIndex((n) => n.notification_id === notificationId)

  if (index === -1) {
    return { success: false, error: 'Notification not found' }
  }

  notifications[index] = {
    ...notifications[index],
    read: true,
    read_at: new Date().toISOString(),
  }

  return { success: true, notification: notifications[index] }
}

/**
 * Mark multiple notifications as read
 */
export const markNotificationsAsReadBulk = (
  notificationIds: string[],
): { markedCount: number; notFound: string[] } => {
  const notFound: string[] = []
  let markedCount = 0

  notificationIds.forEach((id) => {
    const index = notifications.findIndex((n) => n.notification_id === id)
    if (index === -1) {
      notFound.push(id)
    } else if (!notifications[index].read) {
      notifications[index] = {
        ...notifications[index],
        read: true,
        read_at: new Date().toISOString(),
      }
      markedCount++
    }
  })

  return { markedCount, notFound }
}

/**
 * Soft delete a notification
 */
export const deleteNotification = (
  notificationId: string,
): { success: boolean; error?: string } => {
  const index = notifications.findIndex((n) => n.notification_id === notificationId)

  if (index === -1) {
    return { success: false, error: 'Notification not found' }
  }

  notifications[index] = {
    ...notifications[index],
    deleted: true,
    deleted_at: new Date().toISOString(),
  }

  return { success: true }
}

/**
 * Soft delete multiple notifications
 */
export const deleteNotificationsBulk = (
  notificationIds: string[],
): { deletedCount: number; notFound: string[] } => {
  const notFound: string[] = []
  let deletedCount = 0

  notificationIds.forEach((id) => {
    const index = notifications.findIndex((n) => n.notification_id === id)
    if (index === -1) {
      notFound.push(id)
    } else if (!notifications[index].deleted) {
      notifications[index] = {
        ...notifications[index],
        deleted: true,
        deleted_at: new Date().toISOString(),
      }
      deletedCount++
    }
  })

  return { deletedCount, notFound }
}

/**
 * Add a new notification (for testing/simulation)
 */
export const addNotification = (
  pipelineId: string,
  eventType: EventType,
  severity?: NotificationSeverity,
): Notification => {
  const notification = generateMockNotification(pipelineId, eventType, severity)
  notifications.unshift(notification)
  return notification
}

// ============================================================================
// Channels State
// ============================================================================

/**
 * Get all channels
 */
export const getChannels = (): Channel[] => {
  return [...channels]
}

/**
 * Get a single channel by type
 */
export const getChannel = (channelType: ChannelType): Channel | undefined => {
  return channels.find((c) => c.channel_type === channelType)
}

/**
 * Update a channel
 */
export const updateChannel = (
  channelType: ChannelType,
  updates: { enabled?: boolean; config?: Channel['config'] },
): { success: boolean; channel?: Channel; error?: string } => {
  const index = channels.findIndex((c) => c.channel_type === channelType)

  if (index === -1) {
    return { success: false, error: 'Channel not found' }
  }

  channels[index] = {
    ...channels[index],
    ...(updates.enabled !== undefined && { enabled: updates.enabled }),
    ...(updates.config && { config: updates.config }),
    updated_at: new Date().toISOString(),
  }

  return { success: true, channel: channels[index] }
}

/**
 * Delete a channel
 */
export const deleteChannel = (channelType: ChannelType): { success: boolean; error?: string } => {
  const index = channels.findIndex((c) => c.channel_type === channelType)

  if (index === -1) {
    return { success: false, error: 'Channel not found' }
  }

  channels.splice(index, 1)
  return { success: true }
}

// ============================================================================
// Severity Mappings State
// ============================================================================

/**
 * Get all severity mappings
 */
export const getSeverityMappings = (): SeverityMapping[] => {
  return [...severityMappings]
}

/**
 * Get a single severity mapping
 */
export const getSeverityMapping = (severity: SeverityLevel): SeverityMapping | undefined => {
  return severityMappings.find((m) => m.severity === severity)
}

/**
 * Update a severity mapping
 */
export const updateSeverityMapping = (
  severity: SeverityLevel,
  newChannels: ChannelType[],
): { success: boolean; mapping?: SeverityMapping; error?: string } => {
  const index = severityMappings.findIndex((m) => m.severity === severity)

  if (index === -1) {
    return { success: false, error: 'Severity mapping not found' }
  }

  severityMappings[index] = {
    ...severityMappings[index],
    channels: newChannels,
    updated_at: new Date().toISOString(),
  }

  return { success: true, mapping: severityMappings[index] }
}

/**
 * Bulk update severity mappings
 */
export const updateSeverityMappingsBulk = (
  mappingsUpdate: Partial<Record<SeverityLevel, ChannelType[]>>,
): SeverityMapping[] => {
  Object.entries(mappingsUpdate).forEach(([severity, newChannels]) => {
    const index = severityMappings.findIndex((m) => m.severity === severity)
    if (index !== -1) {
      severityMappings[index] = {
        ...severityMappings[index],
        channels: newChannels as ChannelType[],
        updated_at: new Date().toISOString(),
      }
    }
  })

  return [...severityMappings]
}

/**
 * Delete a severity mapping (resets to empty channels)
 */
export const deleteSeverityMapping = (
  severity: SeverityLevel,
): { success: boolean; error?: string } => {
  const index = severityMappings.findIndex((m) => m.severity === severity)

  if (index === -1) {
    return { success: false, error: 'Severity mapping not found' }
  }

  severityMappings[index] = {
    ...severityMappings[index],
    channels: [],
    updated_at: new Date().toISOString(),
  }

  return { success: true }
}

// ============================================================================
// Reset State
// ============================================================================

/**
 * Reset all notifications state to initial values
 */
export const resetNotificationsState = (): void => {
  notifications = [...initialNotifications]
  channels = [...initialChannels]
  severityMappings = [...initialMappings]
}
