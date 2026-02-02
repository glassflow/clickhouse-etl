import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TimeWindowConfigurator } from './TimeWindowConfigurator'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

describe('TimeWindowConfigurator', () => {
  const mockSetWindow = vi.fn()
  const mockSetWindowUnit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders default label and inputs', () => {
    render(
      <TimeWindowConfigurator
        window={1}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.HOURS.value}
        setWindowUnit={mockSetWindowUnit}
      />,
    )
    expect(screen.getByText('Deduplication Time Window')).toBeInTheDocument()
    const input = document.getElementById('window-size')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue(1)
  })

  it('calls setWindow when user enters a valid value', () => {
    render(
      <TimeWindowConfigurator
        window={1}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.DAYS.value}
        setWindowUnit={mockSetWindowUnit}
      />,
    )
    const input = document.getElementById('window-size')
    expect(input).toBeInTheDocument()
    fireEvent.change(input!, { target: { value: '3' } })
    expect(mockSetWindow).toHaveBeenCalledWith(3)
  })

  it('calls setWindowUnit when user selects a different unit', async () => {
    render(
      <TimeWindowConfigurator
        window={1}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.HOURS.value}
        setWindowUnit={mockSetWindowUnit}
      />,
    )
    const trigger = screen.getByRole('combobox', { name: /Deduplication Time Window/i })
    await act(async () => {
      fireEvent.click(trigger)
    })
    const daysOption = await screen.findByRole('option', { name: TIME_WINDOW_UNIT_OPTIONS.DAYS.label })
    await act(async () => {
      fireEvent.click(daysOption)
    })
    expect(mockSetWindowUnit).toHaveBeenCalledWith(TIME_WINDOW_UNIT_OPTIONS.DAYS.value)
  })

  it('shows error when window exceeds max for unit (e.g. 8 days)', () => {
    render(
      <TimeWindowConfigurator
        window={8}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.DAYS.value}
        setWindowUnit={mockSetWindowUnit}
      />,
    )
    expect(screen.getByText(/Maximum time window is 7 days/)).toBeInTheDocument()
  })

  it('does not call setWindow when user enters value exceeding max for days', () => {
    render(
      <TimeWindowConfigurator
        window={5}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.DAYS.value}
        setWindowUnit={mockSetWindowUnit}
      />,
    )
    const input = document.getElementById('window-size')
    fireEvent.change(input!, { target: { value: '10' } })
    expect(mockSetWindow).not.toHaveBeenCalled()
  })

  it('disables inputs when readOnly is true', () => {
    render(
      <TimeWindowConfigurator
        window={1}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.HOURS.value}
        setWindowUnit={mockSetWindowUnit}
        readOnly
      />,
    )
    const input = document.getElementById('window-size')
    expect(input).toBeDisabled()
    const trigger = screen.getByRole('combobox', { name: /Deduplication Time Window/i })
    expect(trigger).toBeDisabled()
  })

  it('renders custom label when provided', () => {
    render(
      <TimeWindowConfigurator
        window={1}
        setWindow={mockSetWindow}
        windowUnit={TIME_WINDOW_UNIT_OPTIONS.HOURS.value}
        setWindowUnit={mockSetWindowUnit}
        label="Custom window label"
      />,
    )
    expect(screen.getByText('Custom window label')).toBeInTheDocument()
  })
})
