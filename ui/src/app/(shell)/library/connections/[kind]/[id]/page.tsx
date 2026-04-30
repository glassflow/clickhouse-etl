import { redirect, notFound } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { ConnectionDetail } from '@/src/modules/library/components/ConnectionDetail'

type PageProps = { params: Promise<{ kind: string; id: string }> }

export default async function ConnectionDetailPage({ params }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { kind, id } = await params
  if (kind !== 'kafka' && kind !== 'clickhouse') notFound()

  return <ConnectionDetail kind={kind} id={id} />
}
