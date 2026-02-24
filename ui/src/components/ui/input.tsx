import * as React from 'react'

import { cn } from '@/src/utils/common.client'

function Input({
  className,
  type,
  error,
  readOnly,
  ...props
}: React.ComponentProps<'input'> & { error?: boolean }) {
  return (
    <input
      type={type}
      data-slot="input"
      readOnly={readOnly}
      aria-invalid={error}
      className={cn(
        'input-regular',
        'input-border-regular',
        'w-full',
        'outline-none',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        'selection:bg-primary selection:text-primary-foreground',
        error && 'input-border-error',
        readOnly && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
