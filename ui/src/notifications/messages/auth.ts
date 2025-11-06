import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK, refreshAction } from './constants'

export const authMessages = {
  /**
   * Unauthorized (401)
   * Not used ATM
   */
  unauthorized: (): NotificationOptions => ({
    variant: 'error',
    title: 'Session expired.',
    description: undefined,
    action: refreshAction,
    reportLink: undefined,
    channel: 'toast',
  }),

  /**
   * Forbidden (403)
   * Not used ATM
   */
  forbidden: (): NotificationOptions => ({
    variant: 'error',
    title: 'Access denied.',
    description: "You don't have permission to perform this action.",
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
