import { notFound, redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { getApiUrl } from '@/src/utils/mock-api'
import { ConnectionDetail } from '@/src/modules/library/components/ConnectionDetail'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

type PageProps = { params: Promise<{ kind: string; id: string }> }

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConnectionDetailPage({ params }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { kind, id } = await params
  if (kind !== 'kafka' && kind !== 'clickhouse') notFound()

  let connection: LibraryConnection
  let usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getKafkaConnection, getClickhouseConnection, getKafkaConnectionUsedBy, getClickhouseConnectionUsedBy } =
      await import('@/src/app/ui-api/mock/data/library-state')

    const raw = kind === 'kafka' ? getKafkaConnection(id) : getClickhouseConnection(id)
    if (!raw) notFound()

    connection = { ...raw, kind, config: raw.config as unknown as Record<string, unknown> }
    const rawUsedBy = kind === 'kafka' ? getKafkaConnectionUsedBy(id) : getClickhouseConnectionUsedBy(id)
    usedBy = rawUsedBy as UsedByEntry[]
  } else {
    const [connRes, usedByRes] = await Promise.all([
      fetch(getApiUrl(`library/connections/${kind}/${id}`), { cache: 'no-store' }),
      fetch(getApiUrl(`library/connections/${kind}/${id}/used-by`), { cache: 'no-store' }),
    ])
    if (!connRes.ok) notFound()
    const raw = await connRes.json()
    connection = { ...raw, kind }
    if (usedByRes.ok) {
      const body = await usedByRes.json()
      usedBy = body.usedBy ?? []
    }
  }

  return <ConnectionDetail connection={connection} usedBy={usedBy} />
}
