// Default report link
export const DEFAULT_REPORT_LINK = 'https://github.com/glassflow/clickhouse-etl/issues'

// Helper to create action for refresh
export const refreshAction = {
  label: 'Refresh page',
  onClick: () => window.location.reload(),
}

// Helper to create action for retry
export const retryAction = (retryFn: () => void) => ({
  label: 'Try again',
  onClick: retryFn,
})
