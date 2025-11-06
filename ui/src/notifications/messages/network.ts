import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK, refreshAction } from './constants'

export const networkMessages = {
  /**
   * Backend unavailable
   * Can happen if our UI lost connection to the Backend/Cluster
   */
  backendUnavailable: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Backend unavailable.',
    description: 'The API is unreachable.',
    action: retryFn ? { label: 'Check your connection', onClick: retryFn } : refreshAction,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'banner', // Important enough for banner
  }),

  /**
   * Request timeout
   * UI is in the middle of some operation request if failing
   */
  requestTimeout: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Request timed out.',
    description: 'The server may be busy.',
    action: retryFn
      ? { label: 'Try again later', onClick: retryFn }
      : {
          label: 'Try again later',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Network error
   */
  networkError: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Network error occurred.',
    description: undefined,
    action: retryFn
      ? { label: 'Check your internet connection', onClick: retryFn }
      : {
          label: 'Check your internet connection',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * API rate limit exceeded
   * Regular info passed from Backend, rarely happens in regular use
   */
  rateLimitExceeded: (retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Too many requests.',
    description: undefined,
    action: retryFn
      ? { label: 'Wait a moment before trying again', onClick: retryFn }
      : {
          label: 'Wait a moment before trying again',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
