import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const platformMessages = {
  /**
   * Platform info unavailable
   * Docker/K8S version detection failed
   */
  infoUnavailable: (): NotificationOptions => ({
    variant: 'info',
    title: 'Unable to determine platform type.',
    description: 'Some features may be limited.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Mock mode fallback
   * Not used ATM
   */
  mockMode: (): NotificationOptions => ({
    variant: 'info',
    title: 'Running in mock mode.',
    description: 'Data may not be persisted.',
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),
}
