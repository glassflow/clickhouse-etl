import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/src/utils/common.client'

const textareaVariants = cva(
  cn(
    'input-regular',
    'w-full',
    'outline-none',
    'min-h-16',
    'resize-y',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
  ),
  {
    variants: {
      variant: {
        default: 'input-border-regular',
        error: 'input-border-regular input-border-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type TextareaProps = React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>

function Textarea({ className, variant, readOnly, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      readOnly={readOnly}
      aria-invalid={variant === 'error' || undefined}
      className={cn(textareaVariants({ variant }), readOnly && 'cursor-not-allowed opacity-50', className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
export type { TextareaProps }
