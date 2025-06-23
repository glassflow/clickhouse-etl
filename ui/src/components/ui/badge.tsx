import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import classnames from 'classnames'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-on-background-positive)] [a&]:hover:bg-[var(--color-background-positive)]/90',
        secondary:
          'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-on-background-positive)] [a&]:hover:bg-[var(--color-background-positive)]/90',
        destructive:
          'border-transparent bg-[var(--color-background-critical)] text-white [a&]:hover:bg-[var(--color-background-critical)]/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        success: 'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-rgb-positive)]',
        warning: 'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-rgb-warning)]',
        error: 'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-rgb-negative)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return <Comp data-slot="badge" className={classnames(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
