import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { TransformDetail } from '@/src/modules/library/components/TransformDetail'

type PageProps = { params: Promise<{ id: string }> }

export default async function TransformDetailPage({ params }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }
  const { id } = await params
  return <TransformDetail id={id} />
}
