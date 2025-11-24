import { redirect } from 'next/navigation'
import { auth0 } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import LoginButton from '@/src/components/auth/LoginButton'
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

    if (hasPipelines) {
      redirect('/pipelines')
    } else {
      redirect('/home')
    }
  }

  // Server-side: Get session using auth0.getSession()
  const session = await auth0.getSession()
  const user = session?.user

  // If user is authenticated, check for pipelines and redirect accordingly
  if (user) {
    const hasPipelines = await checkPipelines()

    console.log('hasPipelines - home page: ', hasPipelines)

    if (hasPipelines) {
      redirect('/pipelines')
    } else {
      redirect('/home')
    }
  }

  // Show landing page for unauthenticated users
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 max-w-2xl mx-auto text-center">
      <h1 className="text-4xl sm:text-5xl font-bold text-brand-gradient">Welcome to Glassflow</h1>
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
