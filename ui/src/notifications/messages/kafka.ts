import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const kafkaMessages = {
  /**
   * Failed to connect to Kafka
   * Requires enriching the message by specifics why connection failed
   */
  connectionFailed: (brokers: string, details?: string): NotificationOptions => ({
    variant: 'error',
    title: 'Failed to connect to Kafka.',
    description: details ? `Unable to connect to ${brokers}. ${details}` : `Unable to connect to ${brokers}.`,
    action: {
      label: 'Verify Kafka credentials',
      onClick: () => {},
    },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch topics
   * We have a valid connection but unexpected error happened during fetching topics
   */
  fetchTopicsFailed: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Failed to fetch topics.',
    description: 'Connection succeeded, but topic listing failed.',
    action: retryFn
      ? { label: 'Check broker permissions and broker status', onClick: retryFn }
      : {
          label: 'Check broker permissions and broker status',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch event from topic
   */
  fetchEventFailed: (topic: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: `Unable to fetch event from topic ${topic}.`,
    description: 'The topic may be empty or inaccessible.',
    action: retryFn
      ? { label: 'Verify topic existence and permissions', onClick: retryFn }
      : {
          label: 'Verify topic existence and permissions',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * End of topic reached
   * Regular info, not even used now in UI because we don't have the topic navigation
   */
  endOfTopicReached: (): NotificationOptions => ({
    variant: 'info',
    title: "You've reached the end of the topic.",
    description: 'No more events available.',
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),

  /**
   * Beginning of topic reached
   */
  beginningOfTopicReached: (): NotificationOptions => ({
    variant: 'info',
    title: "You've reached the beginning of the topic.",
    description: 'No previous events available.',
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),

  /**
   * Empty topic
   * Regular info, happens when we're trying to use the topic that has no events
   */
  emptyTopic: (topic: string): NotificationOptions => ({
    variant: 'info',
    title: `Topic '${topic}' has no messages yet.`,
    description: 'Waiting for data…',
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),

  /**
   * Invalid JSON in event
   * Regular info, while typing event manually, user can make mistakes
   */
  invalidJson: (retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Invalid JSON format.',
    description: 'Property names must be in double quotes.',
    action: retryFn ? { label: 'Correct syntax and try again', onClick: retryFn } : undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'inline', // Usually shown inline in forms
  }),

  /**
   * Kafka timeout
   * Kafka connection times out, usually wrong connection details or connectivity problem
   */
  timeout: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Kafka request timed out.',
    description: 'The broker may be slow or unreachable.',
    action: retryFn
      ? { label: 'Check connection details and retry', onClick: retryFn }
      : {
          label: 'Check connection details and retry',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
