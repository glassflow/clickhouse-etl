import { Suspense } from 'react'
import { getSessionSafely } from '@/src/lib/auth0'
import { redirect } from 'next/navigation'
import { isAuthEnabled, isAiEnabled } from '@/src/utils/auth-config.server'
import HomePageClient from '@/src/components/home/HomePageClient'

export default async function HomePage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  const aiEnabled = isAiEnabled()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient aiEnabled={aiEnabled} />
    </Suspense>
  )
}
