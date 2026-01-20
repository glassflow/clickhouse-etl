/**
 * Notifications API Client
 *
 * Client-side service for interacting with the notification system via proxy routes.
 * All requests go through /ui-api/notifications/* which forwards to the notification service.
 */

// ============================================================================
// Types
// ============================================================================

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical'
export type SeverityLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type ChannelType = 'slack' | 'email'
export type EventType =
  | 'pipeline_deployed'
  | 'pipeline_stopped'
  | 'pipeline_resumed'
  | 'pipeline_deleted'
  | 'pipeline_failed'

export interface NotificationMetadata {
  source?: string
  tags?: string[]
  custom_fields?: Record<string, string>
}

export interface Notification {
  notification_id: string
  pipeline_id: string
  timestamp: string
  severity: NotificationSeverity
  event_type: EventType
  title: string
  message: string
  metadata: NotificationMetadata
  created_at: string
  read?: boolean
  read_at?: string | null
  deleted?: boolean
  deleted_at?: string | null
}

export interface NotificationListResponse {
  notifications: Notification[]
  pagination: {
    total: number
    limit: number
    offset: number
    returned: number
  }
  filters?: {
    pipeline_id?: string
    severity?: NotificationSeverity
    start_date?: string
    end_date?: string
  }
}

export interface NotificationFilters {
  pipeline_id?: string
  severity?: NotificationSeverity
  read_status?: 'read' | 'unread'
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
  include_deleted?: boolean
}

export interface BulkReadResponse {
  message: string
  marked_count: number
  requested_count: number
  not_found?: string[]
}

export interface BulkDeleteResponse {
  message: string
  deleted_count: number
  requested_count: number
  not_found?: string[]
}

export interface SlackChannelConfig {
  webhook_url: string
  default_channel?: string
}

export interface EmailChannelConfig {
  smtp_host: string
  smtp_port?: number
  smtp_username: string
  smtp_password: string
  smtp_use_tls?: boolean
  from_address?: string
  from_name?: string
  to_addresses: string
}

export interface Channel {
  id: number
  channel_type: ChannelType
  enabled: boolean
  config: SlackChannelConfig | EmailChannelConfig
  created_at: string
  updated_at: string
}

export interface ChannelListResponse {
  channels: Channel[]
}

export interface SeverityMapping {
  id: number
  severity: SeverityLevel
  channels: ChannelType[]
  created_at: string
  updated_at: string
}

export interface SeverityMappingListResponse {
  mappings: SeverityMapping[]
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// API Client Class
// ============================================================================

export class NotificationsApiClient {
  private baseUrl = '/ui-api/notifications'

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------

  /**
   * Fetch notifications with optional filters and pagination
   */
  async fetchNotifications(filters?: NotificationFilters): Promise<ApiResponse<NotificationListResponse>> {
    try {
      const params = new URLSearchParams()

      if (filters?.pipeline_id) params.set('pipeline_id', filters.pipeline_id)
      if (filters?.severity) params.set('severity', filters.severity)
      if (filters?.read_status) params.set('read_status', filters.read_status)
      if (filters?.start_date) params.set('start_date', filters.start_date)
      if (filters?.end_date) params.set('end_date', filters.end_date)
      if (filters?.limit) params.set('limit', filters.limit.toString())
      if (filters?.offset) params.set('offset', filters.offset.toString())
      if (filters?.include_deleted) params.set('include_deleted', 'true')

      const queryString = params.toString()
      const url = `${this.baseUrl}${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch notifications' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Fetch a single notification by ID
   */
  async fetchNotification(notificationId: string): Promise<ApiResponse<Notification>> {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}`)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch notification' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<ApiResponse<{ message: string; notification_id: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}/read`, {
        method: 'PATCH',
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to mark notification as read' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markAsReadBulk(notificationIds: string[]): Promise<ApiResponse<BulkReadResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/read-bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: notificationIds }),
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to mark notifications as read' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Soft delete a single notification
   */
  async deleteNotification(notificationId: string): Promise<ApiResponse<{ message: string; notification_id: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete notification' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Soft delete multiple notifications
   */
  async deleteNotificationsBulk(notificationIds: string[]): Promise<ApiResponse<BulkDeleteResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/delete-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: notificationIds }),
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete notifications' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  // --------------------------------------------------------------------------
  // Channels
  // --------------------------------------------------------------------------

  /**
   * Fetch all channel configurations
   */
  async fetchChannels(): Promise<ApiResponse<ChannelListResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/channels`)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch channels' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Fetch a specific channel configuration
   */
  async fetchChannel(channelType: ChannelType): Promise<ApiResponse<Channel>> {
    try {
      const response = await fetch(`${this.baseUrl}/channels/${channelType}`)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch channel' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Create or update a channel configuration
   */
  async updateChannel(
    channelType: ChannelType,
    config: { enabled: boolean; config?: SlackChannelConfig | EmailChannelConfig },
  ): Promise<ApiResponse<Channel>> {
    try {
      const response = await fetch(`${this.baseUrl}/channels/${channelType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update channel' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Delete a channel configuration
   */
  async deleteChannel(channelType: ChannelType): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/channels/${channelType}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to delete channel' }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  // --------------------------------------------------------------------------
  // Severity Mappings
  // --------------------------------------------------------------------------

  /**
   * Fetch all severity-to-channel mappings
   */
  async fetchSeverityMappings(): Promise<ApiResponse<SeverityMappingListResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/severity-mappings`)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch severity mappings' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Bulk update severity mappings
   */
  async updateSeverityMappingsBulk(
    mappings: Partial<Record<SeverityLevel, ChannelType[]>>,
  ): Promise<ApiResponse<SeverityMappingListResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/severity-mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappings),
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update severity mappings' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Fetch a specific severity mapping
   */
  async fetchSeverityMapping(severity: SeverityLevel): Promise<ApiResponse<SeverityMapping>> {
    try {
      const response = await fetch(`${this.baseUrl}/severity-mappings/${severity}`)
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch severity mapping' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Update a specific severity mapping
   */
  async updateSeverityMapping(
    severity: SeverityLevel,
    channels: ChannelType[],
  ): Promise<ApiResponse<SeverityMapping>> {
    try {
      const response = await fetch(`${this.baseUrl}/severity-mappings/${severity}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels }),
      })
      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update severity mapping' }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }

  /**
   * Delete a severity mapping
   */
  async deleteSeverityMapping(severity: SeverityLevel): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/severity-mappings/${severity}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to delete severity mapping' }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error connecting to notification service' }
    }
  }
}

// Singleton instance
export const notificationsApi = new NotificationsApiClient()
