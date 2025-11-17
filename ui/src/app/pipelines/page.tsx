import { Suspense } from 'react'
import { auth0 } from '@/src/lib/auth0'
import { redirect } from 'next/navigation'
import PipelinesPageClient from '@/src/components/pipelines/PipelinesPageClient'

export default async function PipelinesPage() {
  const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  if (isAuthEnabled) {
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
