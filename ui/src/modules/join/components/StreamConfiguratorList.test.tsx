import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamConfiguratorList } from './StreamConfiguratorList'

vi.mock('./StreamConfigurator', () => ({
  StreamConfigurator: ({
    streamIndex,
    stream,
    errors,
  }: {
    streamIndex: number
    stream: { joinKey: string; joinTimeWindowValue: number; joinTimeWindowUnit: string }
    errors: { joinKey?: string; joinTimeWindowValue?: string; joinTimeWindowUnit?: string }
  }) => (
    <div data-testid={`stream-configurator-${streamIndex}`}>
      <span>Stream {streamIndex + 1}</span>
      <span data-testid={`stream-${streamIndex}-joinKey`}>{stream.joinKey}</span>
      <span data-testid={`errors-${streamIndex}`}>
        {errors.joinKey || ''} {errors.joinTimeWindowValue || ''} {errors.joinTimeWindowUnit || ''}
      </span>
    </div>
  ),
}))

vi.mock('@/src/components/shared/EventEditor', () => ({
  EventEditor: ({ topic }: { topic: string }) => <div data-testid="event-editor">EventEditor {topic}</div>,
}))

vi.mock('@/src/utils/common.client', () => ({
  parseForCodeEditor: (x: unknown) => x,
}))

describe('StreamConfiguratorList', () => {
  const defaultStreams = [
    { joinKey: 'id', joinTimeWindowValue: 1, joinTimeWindowUnit: 'minutes' },
    { joinKey: 'userId', joinTimeWindowValue: 2, joinTimeWindowUnit: 'hours' },
  ]
  const defaultDynamicOptions = {
    streams: [
      { joinKey: [{ label: 'id', value: 'id' }], joinTimeWindowUnit: [] },
      { joinKey: [{ label: 'userId', value: 'userId' }], joinTimeWindowUnit: [] },
    ],
  }
  const mockOnChange = vi.fn()

  it('renders two StreamConfigurators and two event preview areas', () => {
    render(
      <StreamConfiguratorList
        streams={defaultStreams}
        dynamicOptions={defaultDynamicOptions}
        onChange={mockOnChange}
        event1={{}}
        event2={{}}
        topic1={{ name: 'topic1' }}
        topic2={{ name: 'topic2' }}
      />,
    )
    expect(screen.getByTestId('stream-configurator-0')).toBeInTheDocument()
    expect(screen.getByTestId('stream-configurator-1')).toBeInTheDocument()
    expect(screen.getAllByTestId('event-editor')).toHaveLength(2)
  })

  it('passes errors including joinTimeWindowUnit to each StreamConfigurator', () => {
    const errors = {
      'streams.0.joinKey': 'Join key is required',
      'streams.0.joinTimeWindowUnit': 'Unit is required',
      'streams.1.joinTimeWindowValue': 'Value must be at least 1',
    }
    render(
      <StreamConfiguratorList
        streams={defaultStreams}
        dynamicOptions={defaultDynamicOptions}
        onChange={mockOnChange}
        errors={errors}
        event1={{}}
        event2={{}}
        topic1={{}}
        topic2={{}}
      />,
    )
    const config0 = screen.getByTestId('errors-0')
    const config1 = screen.getByTestId('errors-1')
    expect(config0).toHaveTextContent('Join key is required')
    expect(config0).toHaveTextContent('Unit is required')
    expect(config1).toHaveTextContent('Value must be at least 1')
  })

  it('displays Stream 1 and Stream 2 sample event headings', () => {
    render(
      <StreamConfiguratorList
        streams={defaultStreams}
        dynamicOptions={defaultDynamicOptions}
        onChange={mockOnChange}
        event1={{}}
        event2={{}}
        topic1={{}}
        topic2={{}}
      />,
    )
    expect(screen.getByText('Stream 1 Sample Event')).toBeInTheDocument()
    expect(screen.getByText('Stream 2 Sample Event')).toBeInTheDocument()
  })
})
