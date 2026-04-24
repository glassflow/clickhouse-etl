import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import LoginButton from '@/src/components/auth/LoginButton'
import { MarketingLandingPage } from '@/src/components/marketing/MarketingLandingPage'
import axios from 'axios'

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server-side function to check if pipelines exist
async function checkPipelines() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_IN_DOCKER === 'true' ? 'http://ui:8080' : 'http://localhost:8080'
    const apiUrl = `${baseUrl}/ui-api/pipeline`

    const response = await axios.get(apiUrl)

    if (response.data?.success && Array.isArray(response.data.pipelines)) {
      return response.data.pipelines.length > 0
    }

    return false
  } catch (error) {
    return false
  }
}

export default async function Home() {
  // Check if Auth0 is enabled (reads from runtime environment)
  const authEnabled = isAuthEnabled()

  // If auth is disabled, check for pipelines and redirect accordingly
  if (!authEnabled) {
    const hasPipelines = await checkPipelines()
    if (hasPipelines) redirect('/pipelines')
    redirect('/home')
  }

  // When auth is enabled, fetch session and pipeline list in parallel for redirect decision
  const [session, hasPipelines] = await Promise.all([getSessionSafely(), checkPipelines()])
  const cookieStore = await cookies()
  const user = session?.user

  if (user) {
    if (hasPipelines) redirect('/pipelines')
    redirect('/home')
  }

  // Unauthenticated: show marketing landing page for visitors arriving from glassflow.dev
  const isFromWebsite = cookieStore.get('gf_from_website')?.value === '1'
  if (isFromWebsite) {
    return <MarketingLandingPage />
  }

  // Default landing page for all other unauthenticated visitors
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 max-w-2xl mx-auto text-center">
      <h1 className="title-1 text-[var(--color-foreground-primary)]">Welcome to Glassflow</h1>
      <p className="text-lg text-muted-foreground max-w-xl">
        Create powerful data pipelines with ready-to-use operations. Sign in to get started with your real-time data
        processing.
      </p>
      <div className="flex gap-4 mt-4">
        <LoginButton />
      </div>
    </div>
  )
}
