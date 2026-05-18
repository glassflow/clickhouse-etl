'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import { NotificationBadge } from './NotificationBadge'

/**
 * Only mount this component when auth is enabled — it requires Auth0Provider context.
 * Hides the notification badge until the user is authenticated.
 */
export function AuthGatedNotificationBadge() {
  const { user } = useUser()
  if (!user) return null
  return <NotificationBadge />
}
