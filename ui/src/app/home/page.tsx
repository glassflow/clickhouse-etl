import { Suspense } from 'react'
import { auth0 } from '@/src/lib/auth0'
import { redirect } from 'next/navigation'
import HomePageClient from '@/src/components/home/HomePageClient'

// Main Page component (Server Component with auth check)
export default async function HomePage() {
  // Check if Auth0 is enabled
  const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  // If auth is enabled, check if user is authenticated
  if (isAuthEnabled) {
    const session = await auth0.getSession()
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
