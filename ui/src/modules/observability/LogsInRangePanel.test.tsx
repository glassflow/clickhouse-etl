import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { LogsInRangePanel } from './LogsInRangePanel'

vi.mock('@/src/hooks/useLogsQuery', () => ({
  useLogsQuery: () => ({
    data: {
      query: '',
      count: 5,
      lines: [
        { _time: '1', component: 'ingestor', severity: 'info', _msg: 'ok' },
        { _time: '2', component: 'ingestor', severity: 'error', _msg: 'boom' },
        { _time: '3', component: 'processor', severity: 'warn', _msg: 'slow' },
        { _time: '4', component: 'processor', severity: 'error', _msg: 'fail' },
        { _time: '5', component: 'sink', severity: 'info', _msg: 'ok' },
      ],
    },
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}))

afterEach(() => cleanup())

describe('LogsInRangePanel', () => {
  it('renders a component breakdown of error/warn counts', async () => {
    render(<LogsInRangePanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText(/ingestor/i)).toBeInTheDocument())
    expect(screen.getByText(/processor/i)).toBeInTheDocument()
    expect(screen.getByText(/sink/i)).toBeInTheDocument()
  })

  it('shows the total line count', async () => {
    render(<LogsInRangePanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText(/5 lines/i)).toBeInTheDocument())
  })
})
