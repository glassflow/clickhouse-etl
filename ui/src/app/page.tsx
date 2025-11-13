'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import { Button } from '@/src/components/ui/button'
import { getRuntimeEnv } from '@/src/utils/common.client'

export default function Home() {
  const { user, isLoading } = useUser()
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Show landing page for unauthenticated users (middleware handles redirects)
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 max-w-2xl mx-auto text-center">
      <h1 className="text-4xl sm:text-5xl font-bold text-brand-gradient">Welcome to Glassflow</h1>
      <p className="text-lg text-muted-foreground max-w-xl">
        Create powerful data pipelines with ready-to-use operations. Sign in to get started with your real-time data
        processing.
      </p>
      <div className="flex gap-4 mt-4">
        <Button asChild size="lg" variant="default">
          <a href="/api/auth/login">Sign In</a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="/api/auth/login?screen_hint=signup">Create Account</a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-8">Secure authentication powered by Auth0</p>
    </div>
  )
}
