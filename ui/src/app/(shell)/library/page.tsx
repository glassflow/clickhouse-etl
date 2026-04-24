import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { LibraryBigIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'

export default async function LibraryPage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="title-2 text-[var(--text-primary)]">Library</h1>
          <p className="body-3 text-[var(--text-secondary)]">
            Reusable pipeline templates, shared transforms, and saved configurations
          </p>
        </div>
        <Badge variant="secondary">Coming soon</Badge>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
        <Card variant="dark" className="flex flex-col items-center gap-5 p-12 max-w-md w-full text-center">
          <span className="text-[var(--color-foreground-primary)]" aria-hidden="true">
            <LibraryBigIcon size={48} strokeWidth={1.25} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="title-4 text-[var(--text-primary)]">Library is coming soon</h2>
            <p className="body-3 text-[var(--text-secondary)]">
              Save and share pipeline templates, reusable transformations, and schema definitions
              across your team.
            </p>
          </div>
          <Badge variant="outline">In development</Badge>
        </Card>
      </div>
    </div>
  )
}
