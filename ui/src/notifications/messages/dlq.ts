import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK, refreshAction } from './constants'

export const dlqMessages = {
  /**
   * Failed to fetch DLQ state
   * UI cannot reach BE or fetch DLQ data
   */
  fetchStateFailed: (): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to load error queue status.',
    description: undefined,
    action: refreshAction,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch DLQ events
   */
  fetchEventsFailed: (): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to load failed events.',
    description: 'The error queue may be empty or temporarily unavailable.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * DLQ stats unavailable (silent)
   */
  statsUnavailable: (): NotificationOptions => ({
    variant: 'error',
    title: 'Health data unavailable.',
    description: 'Unable to determine pipeline status.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
