/**
 * Mock Notifications Data
 *
 * Sample notification data for testing the UI without a real notification service.
 */

import type {
  Notification,
  NotificationSeverity,
  EventType,
  Channel,
  ChannelType,
  SeverityMapping,
  SeverityLevel,
} from '@/src/services/notifications-api'

// Re-export types for convenience
export type { Notification, Channel, SeverityMapping }

// Sample pipeline IDs (should match mock pipelines)
const PIPELINE_IDS = [
  'pipeline-001',
  'pipeline-002',
  'pipeline-003',
  'pipeline-004',
  'pipeline-005',
]

const EVENT_TYPES: EventType[] = [
  'pipeline_deployed',
  'pipeline_stopped',
  'pipeline_resumed',
  'pipeline_deleted',
  'pipeline_failed',
]

const SEVERITIES: NotificationSeverity[] = ['info', 'warning', 'error', 'critical']

// Helper to generate random date within last N days
const randomDate = (daysAgo: number = 7): string => {
  const now = new Date()
  const past = new Date(now.getTime() - Math.random() * daysAgo * 24 * 60 * 60 * 1000)
  return past.toISOString()
}

// Helper to generate notification title based on event type
const getNotificationTitle = (eventType: EventType, pipelineId: string): string => {
  const titles: Record<EventType, string> = {
    pipeline_deployed: `Pipeline ${pipelineId} deployed successfully`,
    pipeline_stopped: `Pipeline ${pipelineId} has been stopped`,
    pipeline_resumed: `Pipeline ${pipelineId} resumed`,
    pipeline_deleted: `Pipeline ${pipelineId} deleted`,
    pipeline_failed: `Pipeline ${pipelineId} encountered an error`,
  }
  return titles[eventType]
}

// Helper to generate notification message based on event type
const getNotificationMessage = (eventType: EventType, pipelineId: string): string => {
  const messages: Record<EventType, string> = {
    pipeline_deployed:
      'The pipeline has been successfully deployed and is now running. All configurations have been applied.',
    pipeline_stopped:
      'The pipeline was stopped by a user action. No data is being processed while stopped.',
    pipeline_resumed:
      'The pipeline has been resumed and is now processing data again. All backlogged messages are being processed.',
    pipeline_deleted:
      'The pipeline and all its configurations have been permanently removed from the system.',
    pipeline_failed:
      'The pipeline encountered an error during processing. Please check the logs for more details and consider restarting the pipeline.',
  }
  return messages[eventType]
}

// Helper to get severity based on event type
const getSeverityForEvent = (eventType: EventType): NotificationSeverity => {
  const severityMap: Record<EventType, NotificationSeverity> = {
    pipeline_deployed: 'info',
    pipeline_stopped: 'warning',
    pipeline_resumed: 'info',
    pipeline_deleted: 'warning',
    pipeline_failed: 'error',
  }
  return severityMap[eventType]
}

// Generate mock notifications
export const generateMockNotifications = (count: number = 20): Notification[] => {
  const notifications: Notification[] = []

  for (let i = 0; i < count; i++) {
    const pipelineId = PIPELINE_IDS[Math.floor(Math.random() * PIPELINE_IDS.length)]
    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
    const timestamp = randomDate(14)
    const isRead = Math.random() > 0.6 // 40% unread

    notifications.push({
      notification_id: `notif-${String(i + 1).padStart(3, '0')}`,
      pipeline_id: pipelineId,
      timestamp,
      severity: getSeverityForEvent(eventType),
      event_type: eventType,
      title: getNotificationTitle(eventType, pipelineId),
      message: getNotificationMessage(eventType, pipelineId),
      metadata: {
        source: 'pipeline-monitor',
        tags: [eventType.replace('pipeline_', ''), pipelineId],
      },
      created_at: timestamp,
      read: isRead,
      read_at: isRead ? new Date(new Date(timestamp).getTime() + 3600000).toISOString() : null,
      deleted: false,
      deleted_at: null,
    })
  }

  // Sort by timestamp descending (newest first)
  return notifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

// Initial mock notifications data
export const mockNotifications: Notification[] = generateMockNotifications(25)

// Mock channels data
export const mockChannels: Channel[] = [
  {
    id: 1,
    channel_type: 'slack',
    enabled: true,
    config: {
      webhook_url: 'https://hooks.slack.com/services/MOCK/WEBHOOK/URL',
      default_channel: '#alerts',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 2,
    channel_type: 'email',
    enabled: false,
    config: {
      smtp_host: 'smtp.example.com',
      smtp_port: 587,
      smtp_username: 'notifications@example.com',
      smtp_password: '********',
      smtp_use_tls: true,
      from_address: 'notifications@example.com',
      from_name: 'GlassFlow Alerts',
      to_addresses: 'admin@example.com',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
]

// Mock severity mappings data
export const mockSeverityMappings: SeverityMapping[] = [
  {
    id: 1,
    severity: 'debug',
    channels: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    severity: 'info',
    channels: ['slack'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    severity: 'warn',
    channels: ['slack'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    severity: 'error',
    channels: ['slack', 'email'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    severity: 'fatal',
    channels: ['slack', 'email'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

// Helper to generate a new notification
export const generateMockNotification = (
  pipelineId: string,
  eventType: EventType,
  severity?: NotificationSeverity,
): Notification => {
  const timestamp = new Date().toISOString()
  return {
    notification_id: `notif-${Date.now()}`,
    pipeline_id: pipelineId,
    timestamp,
    severity: severity || getSeverityForEvent(eventType),
    event_type: eventType,
    title: getNotificationTitle(eventType, pipelineId),
    message: getNotificationMessage(eventType, pipelineId),
    metadata: {
      source: 'pipeline-monitor',
      tags: [eventType.replace('pipeline_', ''), pipelineId],
    },
    created_at: timestamp,
    read: false,
    read_at: null,
    deleted: false,
    deleted_at: null,
  }
}
