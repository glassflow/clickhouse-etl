import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { LibraryClient } from '@/src/modules/library/components/LibraryClient'

export default async function LibraryPage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  return <LibraryClient />
}
