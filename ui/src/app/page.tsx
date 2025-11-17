import { redirect } from 'next/navigation'
import { auth0 } from '@/src/lib/auth0'
import LoginButton from '@/src/components/auth/LoginButton'

export default async function Home() {
  // Check if Auth0 is enabled
  const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  // If auth is disabled, redirect to /home
  if (!isAuthEnabled) {
    redirect('/home')
  }

  // Server-side: Get session using auth0.getSession()
  const session = await auth0.getSession()
  const user = session?.user

  // If user is authenticated, redirect to /home
  if (user) {
    redirect('/home')
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
