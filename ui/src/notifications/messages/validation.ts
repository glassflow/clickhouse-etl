import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const validationMessages = {
  /**
   * Invalid pipeline configuration
   * Almost never happens, only if we enable pipeline config upload
   */
  invalidPipelineConfig: (validationErrors: string[], retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Invalid pipeline configuration.',
    description: `Errors detected: ${validationErrors.join(', ')}.`,
    action: retryFn
      ? { label: 'Review and correct highlighted fields', onClick: retryFn }
      : {
          label: 'Review and correct highlighted fields',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'inline', // Usually shown inline in forms
  }),

  /**
   * Missing required fields
   */
  missingRequiredFields: (fieldList: string[], retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Missing required fields.',
    description: undefined,
    action: retryFn
      ? {
          label: `Please complete all required fields: ${fieldList.join(', ')}`,
          onClick: retryFn,
        }
      : {
          label: `Please complete all required fields: ${fieldList.join(', ')}`,
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'inline', // Usually shown inline in forms
  }),

  /**
   * Duplicate pipeline name
   * Cannot happen, this is just a fallback
   */
  duplicatePipelineName: (name: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Duplicate pipeline name.',
    description: `A pipeline named ${name} already exists.`,
    action: retryFn
      ? { label: 'Choose a different name', onClick: retryFn }
      : {
          label: 'Choose a different name',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Invalid topic mapping
   * Similar to other pipeline configuration problems
   */
  invalidTopicMapping: (issues: string[], retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Invalid topic mapping.',
    description: `The mapping contains errors: ${issues.join(', ')}.`,
    action: retryFn
      ? { label: 'Ensure each field maps to a valid column', onClick: retryFn }
      : {
          label: 'Ensure each field maps to a valid column',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'inline', // Usually shown inline in forms
  }),

  /**
   * Unsupported column type
   */
  unsupportedColumnType: (
    type: string,
    field: string,
    supportedTypes: string[],
    retryFn?: () => void,
  ): NotificationOptions => ({
    variant: 'info',
    title: 'Unsupported column type.',
    description: `${type} is not supported for ${field}.`,
    action: retryFn
      ? {
          label: `Use one of ${supportedTypes.join(', ')}`,
          onClick: retryFn,
        }
      : {
          label: `Use one of ${supportedTypes.join(', ')}`,
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'inline', // Usually shown inline in forms
  }),
}
