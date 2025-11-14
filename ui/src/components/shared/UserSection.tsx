import { useUser } from '@auth0/nextjs-auth0/client'
import LoginButton from '../auth/LoginButton'
import UserProfile from '../auth/UserProfile'

export function UserSection() {
  const { user, isLoading: isUserLoading, error: userError } = useUser()

  if (isUserLoading) {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
  }

  if (userError) {
    return <div>Error: {userError.message}</div>
  }

  if (!user) {
    return <LoginButton />
  }

  return <UserProfile />
}
