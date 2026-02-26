import * as React from 'react'

import { cn } from '@/src/utils/common.client'

const cardVariantClass: Record<string, string> = {
  selectable: 'btn-card',
  outline: 'card-outline',
  elevated: 'card-elevated',
  elevatedSubtle: 'card-elevated-subtle',
  regular: 'card-regular',
}

function Card({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'default' | 'selectable' | 'outline' | 'elevated' | 'elevatedSubtle' | 'regular'
}) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(variant !== 'default' && cardVariantClass[variant], className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-2', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('leading-none font-semibold', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center', className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
