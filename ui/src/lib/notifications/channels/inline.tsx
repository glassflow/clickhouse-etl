'use client'

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import type { NotificationOptions } from '../types'

const variantStyles = {
  success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
  info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
  error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
}

const variantIcons = {
  success: CheckCircle,
  info: Info,
  warning: TriangleAlert,
  error: AlertCircle,
}

export function InlineAlert({ options }: { options: NotificationOptions }): React.ReactElement {
  const { variant, title, description, action, reportLink } = options
  const Icon = variantIcons[variant]
  const styles = variantStyles[variant]

  return (
    <Alert className={cn('border-l-4', styles)}>
      <Icon className="h-5 w-5" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      {description && <AlertDescription className="mt-2">{description}</AlertDescription>}
      {(action || reportLink) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {action && (
            <Button variant="outline" size="sm" onClick={action.onClick} className="text-xs">
              {action.label}
            </Button>
          )}
          {reportLink && (
            <a
              href={reportLink}
              className="text-xs underline hover:no-underline text-muted-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Submit a report
            </a>
          )}
        </div>
      )}
    </Alert>
  )
}
