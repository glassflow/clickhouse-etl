import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/src/utils/common.client'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-background-neutral)] text-[var(--color-foreground-neutral)] [a&]:hover:bg-[var(--color-background-positive-faded)]',
        secondary:
          'border-transparent bg-[var(--surface-bg-sunken)] text-[var(--color-foreground-neutral-faded)] [a&]:hover:bg-[var(--interactive-hover-bg)]',
        destructive:
          'border-transparent bg-[var(--color-background-critical-faded)] text-[var(--color-foreground-critical)] [a&]:hover:bg-[var(--color-background-critical)]/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline: 'text-foreground border-border [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        success:
          'border-transparent bg-[var(--color-background-positive-faded)] text-[var(--color-foreground-positive)]',
        warning:
          'border-transparent bg-[var(--color-background-warning-faded)] text-[var(--color-foreground-warning)]',
        error:
          'border-transparent bg-[var(--color-background-critical-faded)] text-[var(--color-foreground-critical)]',
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

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
