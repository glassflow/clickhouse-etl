import Link from 'next/link'
import { Button } from '@/src/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6 px-4">
      <h2 className="text-2xl font-semibold text-foreground">Page not found</h2>
      <p className="text-sm text-content text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild variant="primary" className="flex items-center gap-2">
        <Link href="/">Go to home</Link>
      </Button>
    </div>
  )
}
