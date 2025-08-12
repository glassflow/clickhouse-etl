import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/src/utils/common.client'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 disabled:opacity-50 disabled:pointer-events-none',
        outline:
          'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 disabled:opacity-50 disabled:pointer-events-none',
        ghost: 'hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
        link: 'text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:pointer-events-none',
        gradient:
          'rounded-md bg-gradient-to-br from-[#FFA959] to-[#E7872E] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.20),0px_4px_8px_0px_rgba(0,0,0,0.30)] hover:shadow-[0px_0px_6px_0px_rgba(0,0,0,0.25),0px_6px_12px_0px_rgba(0,0,0,0.35)] disabled:bg-gradient-to-br disabled:from-[#9A9A9A] disabled:to-[#6E6E6E] disabled:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.10),0px_2px_4px_0px_rgba(0,0,0,0.15)] disabled:pointer-events-none',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        custom: 'min-w-9 min-h-9 px-3 py-2 gap-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
