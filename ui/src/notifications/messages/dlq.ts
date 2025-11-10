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

  /**
   * DLQ purge successful
   */
  purgeSuccess: (): NotificationOptions => ({
    variant: 'success',
    title: 'Error queue cleared successfully.',
    description: 'All failed events have been removed from the error queue.',
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),

  /**
   * DLQ purge failed
   */
  purgeFailed: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Failed to clear error queue.',
    description: 'The error queue could not be cleared.',
    action: retryFn ? { label: 'Try again', onClick: retryFn } : undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
