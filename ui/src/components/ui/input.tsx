import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/src/utils/common.client'

const inputVariants = cva(
  cn(
    'input-regular',
    'w-full',
    'outline-none',
    'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
    'selection:bg-primary selection:text-primary-foreground',
  ),
  {
    variants: {
      variant: {
        default: 'input-border-regular',
        error: 'input-border-regular input-border-error',
      },
      // Size overrides the base 36px from .input-regular when set. `default`
      // is empty so .input-regular's natural height (36px) carries through.
      size: {
        sm: '!h-8 text-xs',
        default: '',
        lg: '!h-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & VariantProps<typeof inputVariants>

function Input({ className, type, variant, size, readOnly, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size ?? 'default'}
      readOnly={readOnly}
      aria-invalid={variant === 'error' || undefined}
      className={cn(inputVariants({ variant, size }), readOnly && 'cursor-not-allowed opacity-50', className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
export type { InputProps }
