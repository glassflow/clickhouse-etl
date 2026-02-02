import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KafkaConnectionContainer } from './KafkaConnectionContainer'
import type { KafkaConnectionFormType } from '@/src/scheme'

const mockTestConnection = vi.fn()
const mockSaveConnectionData = vi.fn()
const mockKafkaStarted = vi.fn()
const mockKafkaSuccess = vi.fn()
const mockKafkaFailed = vi.fn()
const mockResetTopicsStore = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: vi.fn(),
}))

vi.mock('@/src/hooks/useKafkaConnection', () => ({
  useKafkaConnection: () => ({
    testConnection: mockTestConnection,
    connectionResult: null,
    isConnecting: false,
    kafkaConnection: null,
  }),
}))

vi.mock('@/src/modules/kafka/hooks/useKafkaConnectionSave', () => ({
  useKafkaConnectionSave: () => ({
    saveConnectionData: mockSaveConnectionData,
  }),
}))

vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({
    page: { setupKafkaConnection: vi.fn() },
    kafka: {
      started: mockKafkaStarted,
      success: mockKafkaSuccess,
      failed: mockKafkaFailed,
    },
  }),
}))

vi.mock('@/src/hooks/usePipelineActions', () => ({
  usePipelineActions: vi.fn(),
}))

vi.mock('@/src/modules/kafka/components/KafkaConnectionFormManager', () => ({
  KafkaConnectionFormManager: ({
    onTestConnection,
    initialValues,
    readOnly,
    standalone,
    connectionResult,
    isConnecting,
  }: {
    onTestConnection: (values: KafkaConnectionFormType) => Promise<void>
    initialValues: KafkaConnectionFormType
    readOnly: boolean
    standalone?: boolean
    connectionResult: unknown
    isConnecting: boolean
  }) => (
    <div data-testid="kafka-connection-form-manager">
      <span data-testid="initial-values">{JSON.stringify(!!initialValues)}</span>
      <span data-testid="read-only">{String(readOnly)}</span>
      <span data-testid="standalone">{String(standalone)}</span>
      <span data-testid="is-connecting">{String(isConnecting)}</span>
      <button
        type="button"
        data-testid="test-connection-btn"
        onClick={() =>
          onTestConnection({
            authMethod: 'NO_AUTH',
            securityProtocol: 'PLAINTEXT',
            bootstrapServers: 'localhost:9092',
          } as KafkaConnectionFormType)
        }
      >
        Test connection
      </button>
    </div>
  ),
}))

import { useStore } from '@/src/store'

describe('KafkaConnectionContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStore).mockReturnValue({
      kafkaStore: {
        authMethod: 'NO_AUTH',
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        saslPlain: null,
        saslGssapi: null,
        noAuth: null,
        saslScram256: null,
        saslScram512: null,
      },
      topicsStore: { resetTopicsStore: mockResetTopicsStore },
      coreStore: { topicCount: 1 },
    } as ReturnType<typeof useStore>)
  })

  it('renders without throwing and passes initialValues, readOnly, standalone, connectionResult, isConnecting to form manager', async () => {
    await act(async () => {
      render(
        <KafkaConnectionContainer validate={async () => true} />,
      )
    })

    expect(screen.getByTestId('kafka-connection-form-manager')).toBeInTheDocument()
    expect(screen.getByTestId('initial-values')).toHaveTextContent('true')
    expect(screen.getByTestId('read-only')).toHaveTextContent('false')
    expect(screen.getByTestId('standalone')).toHaveTextContent('undefined')
    expect(screen.getByTestId('is-connecting')).toHaveTextContent('false')
  })

  it('on test connection success: calls saveConnectionData with form values and analytics success', async () => {
    mockTestConnection.mockResolvedValue({ success: true })

    await act(async () => {
      render(<KafkaConnectionContainer validate={async () => true} />)
    })

    const btn = screen.getByTestId('test-connection-btn')
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(mockKafkaStarted).toHaveBeenCalled()
    expect(mockTestConnection).toHaveBeenCalled()
    expect(mockSaveConnectionData).toHaveBeenCalledWith(
      expect.objectContaining({
        authMethod: 'NO_AUTH',
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'localhost:9092',
      }),
    )
    expect(mockKafkaSuccess).toHaveBeenCalled()
    expect(mockKafkaFailed).not.toHaveBeenCalled()
  })

  it('on test connection failure: does not call saveConnectionData and calls analytics failed', async () => {
    mockTestConnection.mockResolvedValue({ success: false, message: 'Connection refused' })

    await act(async () => {
      render(<KafkaConnectionContainer validate={async () => true} />)
    })

    const btn = screen.getByTestId('test-connection-btn')
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(mockKafkaStarted).toHaveBeenCalled()
    expect(mockTestConnection).toHaveBeenCalled()
    expect(mockSaveConnectionData).not.toHaveBeenCalled()
    expect(mockKafkaFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        authMethod: 'NO_AUTH',
        securityProtocol: 'PLAINTEXT',
        error: 'Connection refused',
      }),
    )
  })
})
