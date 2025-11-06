'use client'

import { useCallback } from 'react'
import React from 'react'
import { notify } from '@/src/notifications/notify'
import { InlineAlert } from '@/src/notifications/channels/inline'
import type { NotificationOptions } from '@/src/notifications/types'

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
