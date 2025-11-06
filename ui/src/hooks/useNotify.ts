'use client'

import { useCallback } from 'react'
import React from 'react'
import { notify } from '@/src/lib/notifications/notify'
import { InlineAlert } from '@/src/lib/notifications/channels/inline'
import type { NotificationOptions } from '@/src/lib/notifications/types'

export function useNotify() {
  const notifyFn = useCallback((options: NotificationOptions): string | number | React.ReactElement | void => {
    // Handle inline channel specially
    if (options.channel === 'inline') {
      return React.createElement(InlineAlert, { options })
    }
    return notify(options)
  }, [])

  return { notify: notifyFn }
}
