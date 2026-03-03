'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import LoginButton from '../auth/LoginButton'
import UserProfile from '../auth/UserProfile'
import { structuredLogger } from '@/src/observability'
import { getRuntimeEnv } from '@/src/utils/common.client'

export function UserSection() {
  // Double-check that auth is actually enabled before rendering anything
  // This prevents rendering auth components when auth is disabled
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  // If auth is disabled, don't render anything
  // This is a safety check in case this component is rendered incorrectly
  if (!isAuthEnabled) {
    structuredLogger.warn('UserSection auth is disabled but UserSection was rendered')
    return null
  }

  const { user, isLoading: isUserLoading, error: userError } = useUser()

  if (isUserLoading) {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
  }

  // 401 Unauthorized is expected when user is not logged in, not an error
  // Only show error for actual errors (network issues, server errors, etc.)
  if (userError && !userError.message?.includes('Unauthorized')) {
    structuredLogger.error('UserSection unexpected error', { error: userError instanceof Error ? userError.message : String(userError) })
    return <LoginButton />
  }

  if (!user) {
    return <LoginButton />
  }

  return <UserProfile />
}
