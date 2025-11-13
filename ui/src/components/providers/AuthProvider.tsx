'use client'

import { Auth0Provider } from '@auth0/nextjs-auth0/client'
import { getRuntimeEnv } from '@/src/utils/common.client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  // If auth is disabled, just render children without auth context
  if (!isAuthEnabled) {
    return <>{children}</>
  }

  // If enabled, wrap with Auth0Provider
  // The profile endpoint is configured via NEXT_PUBLIC_AUTH0_PROFILE env var
  return <Auth0Provider>{children}</Auth0Provider>
}
