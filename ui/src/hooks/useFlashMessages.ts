'use client'

import { useEffect } from 'react'
import Cookies from 'js-cookie'
import { notify } from '@/src/notifications/notify'
import { structuredLogger } from '@/src/observability'
import type { FlashMessage } from '@/src/notifications/types'

const FLASH_COOKIE_NAME = 'flash_message'

export function useFlashMessages() {
  useEffect(() => {
    const flashCookie = Cookies.get(FLASH_COOKIE_NAME)
    if (flashCookie) {
      try {
        const message: FlashMessage = JSON.parse(flashCookie)

        // Convert flash message to notification options
        notify({
          variant: message.variant,
          title: message.title,
          description: message.description,
          action: message.action
            ? {
                label: message.action.label,
                onClick: () => {
                  // Actions from server need to be handled client-side
                  // This is a placeholder - you'll need to implement specific actions
                },
              }
            : undefined,
          reportLink: message.reportLink,
          channel: message.channel || 'toast',
        })

        // Clear the cookie after displaying
        Cookies.remove(FLASH_COOKIE_NAME)
      } catch (error) {
        structuredLogger.error('Failed to parse flash message', { error: error instanceof Error ? error.message : String(error) })
        Cookies.remove(FLASH_COOKIE_NAME)
      }
    }
  }, [])
}

// Helper function for server actions to set flash messages
export function setFlashMessage(message: FlashMessage) {
  if (typeof window === 'undefined') {
    // Server-side: This would be called from a server action
    // You'll need to implement cookie setting in your server action
    return
  }
  // Client-side fallback (for testing)
  Cookies.set(FLASH_COOKIE_NAME, JSON.stringify(message), { expires: 1 })
}
