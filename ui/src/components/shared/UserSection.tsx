import { useUser } from '@auth0/nextjs-auth0/client'
import LoginButton from '../auth/LoginButton'
import UserProfile from '../auth/UserProfile'

export function UserSection() {
  const { user, isLoading: isUserLoading, error: userError } = useUser()

  if (isUserLoading) {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
  }

  // 401 Unauthorized is expected when user is not logged in, not an error
  // Only show error for actual errors (network issues, server errors, etc.)
  if (userError && !userError.message?.includes('Unauthorized')) {
    console.error('[UserSection] Unexpected error:', userError)
    return <LoginButton />
  }

  if (!user) {
    return <LoginButton />
  }

  return <UserProfile />
}
