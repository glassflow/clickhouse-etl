import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const serverMessages = {
  /**
   * Internal server error
   * The server encountered an internal error
   */
  internalServerError: (): NotificationOptions => ({
    variant: 'error',
    title: 'Internal server error.',
    description: 'The server encountered an internal error. Please try again later.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'banner',
  }),

  /**
   * Service unavailable
   * The server is temporarily unavailable
   */
  serviceUnavailable: (): NotificationOptions => ({
    variant: 'error',
    title: 'Service unavailable.',
    description: 'The server is temporarily unavailable. Please try again later.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'banner',
  }),
}
