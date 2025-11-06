import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const dataProcessingMessages = {
  /**
   * Schema mismatch
   * Purely BE Error, cannot reach UI for now
   */
  schemaMismatch: (): NotificationOptions => ({
    variant: 'error',
    title: 'Schema mismatch detected.',
    description: "The event schema doesn't match the expected format.",
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Data type conversion error
   * Purely BE Error, cannot reach UI for now
   */
  dataTypeConversionError: (value: string, expectedType: string, field: string): NotificationOptions => ({
    variant: 'error',
    title: 'Data type conversion failed.',
    description: `Unable to convert ${value} to ${expectedType} for ${field}.`,
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Join configuration error
   * Purely BE Error, cannot reach UI for now
   */
  joinConfigurationError: (error: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Invalid join configuration.',
    description: error,
    action: retryFn
      ? { label: 'Verify that join keys exist in both topics', onClick: retryFn }
      : {
          label: 'Verify that join keys exist in both topics',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Deduplication key missing
   * Purely BE Error, cannot reach UI for now
   */
  deduplicationKeyMissing: (key: string): NotificationOptions => ({
    variant: 'error',
    title: 'Deduplication key missing.',
    description: `${key} not found in event.`,
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
