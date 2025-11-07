import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const metricsMessages = {
  /**
   * Failed to fetch ClickHouse metrics
   * Can happen only if we lost connection to clickhouse
   */
  fetchClickHouseMetricsFailed: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to load ClickHouse metrics.',
    description: undefined,
    action: retryFn
      ? { label: 'Check the ClickHouse connection', onClick: retryFn }
      : {
          label: 'Check the ClickHouse connection',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch pipeline health
   * Happens when connection between UI and Pipeline backend is lost
   */
  fetchHealthFailed: (): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to load pipeline health data.',
    description: 'Showing cached results.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
