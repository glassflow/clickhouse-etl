import { Suspense } from 'react'
import { getSessionSafely } from '@/src/lib/auth0'
import { redirect } from 'next/navigation'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import HomePageClient from '@/src/components/home/HomePageClient'

// Main Page component (Server Component with auth check)
export default async function HomePage() {
  // Check if Auth0 is enabled (reads from runtime environment)
  const authEnabled = isAuthEnabled()

  // If auth is enabled, check if user is authenticated
  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      // Not authenticated, redirect to landing page
      redirect('/')
    }
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient />
    </Suspense>
  )
}
