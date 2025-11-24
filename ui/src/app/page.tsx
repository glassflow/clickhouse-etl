import { redirect } from 'next/navigation'
import { auth0 } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import LoginButton from '@/src/components/auth/LoginButton'
import axios from 'axios'
import { runtimeConfig } from '@/src/app/ui-api/config'

// Server-side function to check if pipelines exist
async function checkPipelines() {
  try {
    // Use the same API URL pattern as the route handler
    const API_URL = runtimeConfig.apiUrl
    const response = await axios.get(`${API_URL}/pipeline`)

    if (response.data && Array.isArray(response.data)) {
      return response.data.length > 0
    }

    return false
  } catch (error) {
    console.error('Failed to check pipelines:', error)
    // On error, assume no pipelines to show the safer default
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
