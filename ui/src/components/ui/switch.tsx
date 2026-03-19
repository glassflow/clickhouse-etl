'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/src/utils/common.client'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    className={cn(
      'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors overflow-hidden',
      'w-[var(--toggle-track-width)] h-[var(--toggle-track-height)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=unchecked]:bg-[var(--toggle-track-unchecked-bg)]',
      'data-[state=checked]:bg-[var(--toggle-track-checked-bg)]',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block rounded-full shadow-lg ring-0 transition-transform',
        'h-[var(--toggle-thumb-size)] w-[var(--toggle-thumb-size)]',
        'bg-[var(--toggle-thumb-unchecked-bg)]',
        'data-[state=checked]:bg-[var(--toggle-thumb-checked-bg)]',
        'data-[state=unchecked]:translate-x-0',
        'data-[state=checked]:translate-x-2',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
