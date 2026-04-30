import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '../drawer'

describe('Drawer', () => {
  it('opens when trigger is clicked and shows the title', async () => {
    render(
      <Drawer>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Test Drawer</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    )

    fireEvent.click(screen.getByText('Open'))
    expect(await screen.findByText('Test Drawer')).toBeInTheDocument()
  })

  it('calls onOpenChange when escape is pressed', async () => {
    const handleOpenChange = vi.fn()
    render(
      <Drawer open onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>X</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    )

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders the overlay', async () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>X</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    )

    expect(document.querySelector('[data-drawer-overlay]')).toBeTruthy()
  })

  it('supports the "side=left" variant', async () => {
    render(
      <Drawer open>
        <DrawerContent side="left">
          <DrawerHeader>
            <DrawerTitle>Left Drawer</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    )

    const content = await screen.findByRole('dialog')
    expect(content.getAttribute('data-side')).toBe('left')
  })
})
