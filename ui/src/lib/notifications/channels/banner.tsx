'use client'

import React from 'react'
import { XIcon, AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/utils/common.client'
import type { NotificationOptions } from '../types'

interface BannerProps {
  options: NotificationOptions
  onDismiss: () => void
}

const variantStyles = {
  success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
  info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
  warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
  error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
}

const variantIcons = {
  success: CheckCircle,
  info: Info,
  warning: TriangleAlert,
  error: AlertCircle,
}

export function Banner({ options, onDismiss }: BannerProps) {
  const { variant, title, description, action, reportLink } = options
  const Icon = variantIcons[variant]
  const styles = variantStyles[variant]

  return (
    <Alert className={cn('border-l-4 rounded-lg shadow-lg', styles)}>
      <Icon className="h-5 w-5" />
      <div className="flex-1">
        <AlertTitle className="font-semibold mb-1">{title}</AlertTitle>
        {description && <AlertDescription className="mb-3">{description}</AlertDescription>}
        {(action || reportLink) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {action && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  action.onClick()
                  onDismiss()
                }}
                className="text-xs"
              >
                {action.label}
              </Button>
            )}
            {reportLink && (
              <a
                href={reportLink}
                className="text-xs underline hover:no-underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Submit a report
              </a>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="ml-4 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </Alert>
  )
}
