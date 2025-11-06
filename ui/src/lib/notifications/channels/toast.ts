import { toast as sonnerToast } from 'sonner'
import type { NotificationOptions } from '../types'

export function showToast(options: NotificationOptions): string | number {
  const {
    variant,
    title,
    description,
    action,
    reportLink,
    duration = 5000,
  } = options

  // Build the description with action and report link
  let fullDescription = description || ''

  if (action || reportLink) {
    const parts: string[] = []
    if (action) {
      parts.push(`**What to do:** ${action.label}`)
    }
    if (reportLink) {
      parts.push(
        `If the issue persists, please [submit a report](${reportLink}) so we can investigate.`
      )
    }
    if (parts.length > 0) {
      fullDescription = fullDescription
        ? `${fullDescription}\n\n${parts.join(' ')}`
        : parts.join(' ')
    }
  }

  // Create action button for toast
  const actionButton = action
    ? {
        label: action.label,
        onClick: () => {
          action.onClick()
        },
      }
    : undefined

  // Map our variants to Sonner's types
  const sonnerType = variant === 'error' ? 'error' : variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'info'

  return sonnerToast[sonnerType](title, {
    description: fullDescription || undefined,
    duration,
    action: actionButton,
  })
}
