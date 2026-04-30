import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionBlastRadiusDialog } from '../ConnectionBlastRadiusDialog'

const usedBy = [
  { pipelineId: 'p1', pipelineName: 'orders-prod' },
  { pipelineId: 'p2', pipelineName: 'orders-stg' },
]

describe('ConnectionBlastRadiusDialog', () => {
  it('lists every affected pipeline', () => {
    render(
      <ConnectionBlastRadiusDialog
        open
        usedBy={usedBy}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('orders-prod')).toBeInTheDocument()
    expect(screen.getByText('orders-stg')).toBeInTheDocument()
  })

  it('disables Confirm until checkbox is checked', () => {
    render(
      <ConnectionBlastRadiusDialog
        open
        usedBy={usedBy}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const confirm = screen.getByRole('button', { name: /Save and apply live/ })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/I understand/))
    expect(confirm).not.toBeDisabled()
  })

  it('calls onConfirm when confirmed', () => {
    const onConfirm = vi.fn()
    render(
      <ConnectionBlastRadiusDialog
        open
        usedBy={usedBy}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByLabelText(/I understand/))
    fireEvent.click(screen.getByRole('button', { name: /Save and apply live/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
