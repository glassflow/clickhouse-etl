import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamConfigurator } from './StreamConfigurator'

vi.mock('@/src/modules/deduplication/components/TimeWindowConfigurator', () => ({
  TimeWindowConfigurator: ({
    window,
    windowUnit,
    label,
  }: {
    window: number
    windowUnit: string
    label: string
  }) => (
    <div data-testid="time-window-configurator">
      <span data-testid="window-value">{window}</span>
      <span data-testid="window-unit">{windowUnit}</span>
      <span data-testid="window-label">{label}</span>
    </div>
  ),
}))

describe('StreamConfigurator', () => {
  const mockOnChange = vi.fn()
  const defaultStream = {
    joinKey: 'userId',
    joinTimeWindowValue: 1,
    joinTimeWindowUnit: 'minutes',
  }
  const defaultAvailableKeys = [
    { label: 'id', value: 'id' },
    { label: 'userId', value: 'userId' },
  ]

  it('renders stream index heading and join key select', () => {
    render(
      <StreamConfigurator
        streamIndex={0}
        stream={defaultStream}
        availableKeys={defaultAvailableKeys}
        onChange={mockOnChange}
      />,
    )
    expect(screen.getByText('Stream 1')).toBeInTheDocument()
    expect(screen.getByText('Join Key')).toBeInTheDocument()
    expect(screen.getByTestId('time-window-configurator')).toBeInTheDocument()
  })

  it('passes correct props to TimeWindowConfigurator', () => {
    render(
      <StreamConfigurator
        streamIndex={1}
        stream={{ ...defaultStream, joinTimeWindowValue: 2, joinTimeWindowUnit: 'hours' }}
        availableKeys={defaultAvailableKeys}
        onChange={mockOnChange}
      />,
    )
    expect(screen.getByTestId('window-value')).toHaveTextContent('2')
    expect(screen.getByTestId('window-unit')).toHaveTextContent('hours')
    expect(screen.getByTestId('window-label')).toHaveTextContent('Join Time Window')
  })

  it('displays joinKey error when passed', () => {
    render(
      <StreamConfigurator
        streamIndex={0}
        stream={defaultStream}
        availableKeys={defaultAvailableKeys}
        onChange={mockOnChange}
        errors={{ joinKey: 'Join key is required' }}
      />,
    )
    expect(screen.getByText('Join key is required')).toBeInTheDocument()
  })

  it('displays joinTimeWindowValue error when passed', () => {
    render(
      <StreamConfigurator
        streamIndex={0}
        stream={defaultStream}
        availableKeys={defaultAvailableKeys}
        onChange={mockOnChange}
        errors={{ joinTimeWindowValue: 'Time window value must be at least 1' }}
      />,
    )
    expect(screen.getByText('Time window value must be at least 1')).toBeInTheDocument()
  })

  it('displays joinTimeWindowUnit error when passed', () => {
    render(
      <StreamConfigurator
        streamIndex={0}
        stream={defaultStream}
        availableKeys={defaultAvailableKeys}
        onChange={mockOnChange}
        errors={{ joinTimeWindowUnit: 'Time window unit is required' }}
      />,
    )
    expect(screen.getByText('Time window unit is required')).toBeInTheDocument()
  })
})
