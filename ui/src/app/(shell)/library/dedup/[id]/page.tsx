import { notFound } from 'next/navigation'
import { getApiUrl } from '@/src/utils/mock-api'
import { DedupConfigDetail } from '@/src/modules/library/components/DedupConfigDetail'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ id: string }> }

export default async function DedupConfigPage({ params }: Props) {
  const { id } = await params

  let config: LibraryDedupConfig
  const usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getDedupConfig } = await import('@/src/app/ui-api/mock/data/library-state')
    const found = getDedupConfig(id)
    if (!found) notFound()
    config = found as LibraryDedupConfig
  } else {
    const res = await fetch(getApiUrl(`library/dedup/${id}`), { cache: 'no-store' })
    if (!res.ok) notFound()
    config = await res.json()
  }

  return <DedupConfigDetail config={config} usedBy={usedBy} />
}
