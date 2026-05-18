'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import { getRuntimeEnv } from '@/src/utils/common.client'
import { NotificationsPanel } from './NotificationsPanel'

// Only mounted when isAuthEnabled is true — guaranteed Auth0Provider context
function AuthGatedNotificationsPanel() {
  const { user } = useUser()
  if (!user) return null
  return <NotificationsPanel />
}

/**
 * Renders NotificationsPanel only when the user is authenticated (when auth is enabled).
 * When auth is disabled the panel is shown unconditionally (dev/self-hosted mode).
 */
export function NotificationsPanelWrapper() {
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  if (isAuthEnabled) {
    return <AuthGatedNotificationsPanel />
  }
  return <NotificationsPanel />
}
