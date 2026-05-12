import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopingNoteBanner } from './ScopingNoteBanner'

describe('ScopingNoteBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('renders the scoping note', () => {
    render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    expect(screen.getByText(/pipeline_id/i)).toBeInTheDocument()
  })

  it('hides itself after dismiss and remembers the dismissal', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/pipeline_id/i)).toBeNull()
    unmount()

    render(<ScopingNoteBanner pipelineId="abc-h8z9a" />)
    expect(screen.queryByText(/pipeline_id/i)).toBeNull()
  })
})
