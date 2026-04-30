import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SchemaVersionPublishModal } from '../SchemaVersionPublishModal'

describe('SchemaVersionPublishModal', () => {
  it('shows next version preview based on bump radio', () => {
    render(
      <SchemaVersionPublishModal
        open
        latestVersion="1.4.2"
        currentFields={[{ name: 'a', type: 'string', nullable: false }]}
        onClose={() => {}}
        onPublish={() => Promise.resolve()}
      />,
    )

    // default bump = minor
    expect(screen.getByText('1.5.0')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Major/))
    expect(screen.getByText('2.0.0')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Patch/))
    expect(screen.getByText('1.4.3')).toBeInTheDocument()
  })

  it('shows 1.0.0 when there is no previous version', () => {
    render(
      <SchemaVersionPublishModal
        open
        latestVersion={null}
        currentFields={[{ name: 'a', type: 'string', nullable: false }]}
        onClose={() => {}}
        onPublish={() => Promise.resolve()}
      />,
    )
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('calls onPublish with bump and summary', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined)
    render(
      <SchemaVersionPublishModal
        open
        latestVersion="1.0.0"
        currentFields={[{ name: 'a', type: 'string', nullable: false }]}
        onClose={() => {}}
        onPublish={onPublish}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/What changed/), {
      target: { value: 'added field' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }))

    expect(onPublish).toHaveBeenCalledWith({
      bump: 'minor',
      changeSummary: 'added field',
      fields: [{ name: 'a', type: 'string', nullable: false }],
    })
  })
})
