'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerPortal = DialogPrimitive.Portal
const DrawerClose = DialogPrimitive.Close

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: 'right' | 'left'
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = 'right', ...props }, ref) => (
  <DrawerPortal>
    <DialogPrimitive.Overlay
      data-drawer-overlay
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
    />
    <DialogPrimitive.Content
      ref={ref}
      data-side={side}
      className={cn(
        'fixed top-0 z-50 h-full w-[480px] max-w-[90vw] flex flex-col',
        'bg-[var(--color-background-elevation-raised)] border-[var(--surface-border)]',
        'shadow-[var(--shadow-drawer)]',
        side === 'right' &&
          'right-0 border-l data-[state=open]:animate-drawerSlideInRight data-[state=closed]:animate-drawerSlideOutRight',
        side === 'left' &&
          'left-0 border-r data-[state=open]:animate-drawerSlideInLeft data-[state=closed]:animate-drawerSlideOutLeft',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)] transition-colors"
        aria-label="Close drawer"
      >
        <XIcon size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-1 px-6 pt-5 pb-4 border-b border-[var(--surface-border)]', className)}
    {...props}
  />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('title-5 text-[var(--text-primary)]', className)}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('body-3 text-[var(--text-secondary)]', className)}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

const DrawerBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
)
DrawerBody.displayName = 'DrawerBody'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--surface-border)]',
      className,
    )}
    {...props}
  />
)
DrawerFooter.displayName = 'DrawerFooter'

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
}
