import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { SchemaDetail } from '@/src/modules/library/components/SchemaDetail'

type PageProps = { params: Promise<{ id: string }> }

export default async function SchemaDetailPage({ params }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }
  const { id } = await params
  return <SchemaDetail id={id} />
}
