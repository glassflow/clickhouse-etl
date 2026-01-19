import * as React from 'react'

import { cn } from '@/src/utils/common.client'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'input-regular',
        'input-border-regular',
        'w-full',
        'outline-none',
        'min-h-16',
        'resize-y',
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
