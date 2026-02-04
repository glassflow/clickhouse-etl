import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableContextMenu } from './TableContextMenu'

vi.mock('@/src/utils/common.client', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  isDemoMode: () => false,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="img">{alt}</span>,
}))

vi.mock('lucide-react', () => ({
  MoreVertical: () => <span data-testid="more-vertical">More</span>,
}))

vi.mock('@/src/images/play-white.svg', () => ({ default: 'play.svg' }))
vi.mock('@/src/images/rename.svg', () => ({ default: 'rename.svg' }))
vi.mock('@/src/images/edit.svg', () => ({ default: 'edit.svg' }))
vi.mock('@/src/images/trash.svg', () => ({ default: 'trash.svg' }))
vi.mock('@/src/images/download-white.svg', () => ({ default: 'download.svg' }))
vi.mock('@/src/images/close.svg', () => ({ default: 'close.svg' }))
vi.mock('@/src/images/stop-white.svg', () => ({ default: 'stop.svg' }))
vi.mock('@/src/images/tag-icon-white.svg', () => ({ default: 'tag.svg' }))

const defaultHandlers = {
  onStop: vi.fn(),
  onResume: vi.fn(),
  onEdit: vi.fn(),
  onRename: vi.fn(),
  onTerminate: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onManageTags: vi.fn(),
}

describe('TableContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const openMenu = () => {
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
  }

  it('opens menu when trigger button is clicked', () => {
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
      />,
    )
    expect(screen.queryByRole('button', { name: /Stop/ })).not.toBeInTheDocument()
    openMenu()
    expect(screen.getByRole('button', { name: /Stop/ })).toBeInTheDocument()
  })

  it('for active status shows Stop and does not show Resume', () => {
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
      />,
    )
    openMenu()
    expect(screen.getByRole('button', { name: /Stop/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument()
  })

  it('for paused status shows Resume', () => {
    render(
      <TableContextMenu
        pipelineStatus="paused"
        {...defaultHandlers}
      />,
    )
    openMenu()
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument()
  })

  it('clicking Stop calls onStop', () => {
    const onStop = vi.fn()
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
        onStop={onStop}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('clicking Resume calls onResume when status is paused', () => {
    const onResume = vi.fn()
    render(
      <TableContextMenu
        pipelineStatus="paused"
        {...defaultHandlers}
        onResume={onResume}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('clicking Download calls onDownload', () => {
    const onDownload = vi.fn()
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
        onDownload={onDownload}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: /Download/ }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('clicking Edit calls onEdit', () => {
    const onEdit = vi.fn()
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
        onEdit={onEdit}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: /Edit Edit/ }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('clicking Rename calls onRename', () => {
    const onRename = vi.fn()
    render(
      <TableContextMenu
        pipelineStatus="active"
        {...defaultHandlers}
        onRename={onRename}
      />,
    )
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: /Rename Rename/ }))
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('for stopped status shows Delete', () => {
    render(
      <TableContextMenu
        pipelineStatus="stopped"
        {...defaultHandlers}
      />,
    )
    openMenu()
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument()
  })

  it('does not open menu when disabled', () => {
    render(
      <TableContextMenu
        pipelineStatus="active"
        disabled
        {...defaultHandlers}
      />,
    )
    openMenu()
    expect(screen.queryByRole('button', { name: /Stop/ })).not.toBeInTheDocument()
  })
})
