import * as React from 'react'

import { cn } from '@/src/utils/common.client'

function Textarea({
  className,
  error,
  readOnly,
  ...props
}: React.ComponentProps<'textarea'> & { error?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      readOnly={readOnly}
      aria-invalid={error}
      className={cn(
        'input-regular',
        'input-border-regular',
        'w-full',
        'outline-none',
        'min-h-16',
        'resize-y',
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        error && 'input-border-error',
        readOnly && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
