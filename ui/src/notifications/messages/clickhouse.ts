import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK } from './constants'

export const clickhouseMessages = {
  /**
   * Failed to connect to ClickHouse
   * Usually connection parameters problem
   */
  connectionFailed: (host: string, port: number, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Failed to connect to ClickHouse.',
    description: `Could not reach ${host}:${port}.`,
    action: retryFn
      ? {
          label: 'Verify host, port, credentials, and SSL configuration',
          onClick: retryFn,
        }
      : {
          label: 'Verify host, port, credentials, and SSL configuration',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch databases
   * Can happen in edit mode or preview mode if connection is lost
   */
  fetchDatabasesFailed: (host: string, port: number, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Failed to connect to ClickHouse.',
    description: `Could not reach ${host}:${port}.`,
    action: retryFn
      ? {
          label: 'Verify host, port, credentials, and SSL configuration',
          onClick: retryFn,
        }
      : {
          label: 'Verify host, port, credentials, and SSL configuration',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch tables
   */
  fetchTablesFailed: (database: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: `Unable to list tables in ${database}.`,
    description: undefined,
    action: retryFn
      ? { label: 'Verify the database name and access rights', onClick: retryFn }
      : {
          label: 'Verify the database name and access rights',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch table schema
   */
  fetchSchemaFailed: (database: string, table: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: `Unable to read schema for ${database}.${table}.`,
    description: undefined,
    action: retryFn
      ? { label: 'Ensure the table exists and you have access', onClick: retryFn }
      : {
          label: 'Ensure the table exists and you have access',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Database not found
   */
  databaseNotFound: (database: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: `Database ${database} not found.`,
    description: undefined,
    action: retryFn
      ? { label: 'Choose an existing database or create one', onClick: retryFn }
      : {
          label: 'Choose an existing database or create one',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Table not found
   */
  tableNotFound: (table: string, database: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: `Table ${table} not found in ${database}.`,
    description: undefined,
    action: retryFn
      ? { label: 'Select an existing table or update configuration', onClick: retryFn }
      : {
          label: 'Select an existing table or update configuration',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * SSL certificate error
   * Connectivity problem, either server requires certificate and invalid is provided
   */
  sslCertificateError: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'SSL certificate verification failed.',
    description: undefined,
    action: retryFn
      ? {
          label: 'Enable "Skip Certificate Verification" or add a valid CA certificate',
          onClick: retryFn,
        }
      : {
          label: 'Enable "Skip Certificate Verification" or add a valid CA certificate',
          onClick: () => {},
        },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),
}
