import { Suspense } from 'react'
import { auth0 } from '@/src/lib/auth0'
import { redirect } from 'next/navigation'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import PipelinesPageClient from '@/src/components/pipelines/PipelinesPageClient'

export default async function PipelinesPage() {
  // Check if Auth0 is enabled (reads from runtime environment)
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await auth0.getSession()
    if (!session?.user) {
      redirect('/')
    }
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PipelinesPageClient />
    </Suspense>
  )
}
