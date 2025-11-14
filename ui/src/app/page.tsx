import { Button } from '@/src/components/ui/button'
import { auth0 } from '@/src/lib/auth0'
import LoginButton from '@/src/components/auth/LoginButton'
import UserProfile from '@/src/components/auth/UserProfile'

export default async function Home() {
  // Server-side: Get session using auth0.getSession()
  const session = await auth0.getSession()
  const user = session?.user

  // Show landing page
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 max-w-2xl mx-auto text-center">
      <h1 className="text-4xl sm:text-5xl font-bold text-brand-gradient">Welcome to Glassflow</h1>
      <p className="text-lg text-muted-foreground max-w-xl">
        Create powerful data pipelines with ready-to-use operations. Sign in to get started with your real-time data
        processing.
      </p>
      <div className="flex gap-4 mt-4">
        {user ? <div className="text-lg">Welcome back, {user.name}!</div> : <LoginButton />}
      </div>
      {/* <p className="text-xs text-muted-foreground text-content mt-8">Secure authentication powered by Auth0</p> */}
    </div>
  )
}
