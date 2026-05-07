import { notFound } from 'next/navigation'
import { getApiUrl } from '@/src/utils/mock-api'
import { FilterConfigDetail } from '@/src/modules/library/components/FilterConfigDetail'
import type { LibraryFilterConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ id: string }> }

export default async function FilterConfigPage({ params }: Props) {
  const { id } = await params

  let config: LibraryFilterConfig
  const usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getFilterConfig } = await import('@/src/app/ui-api/mock/data/library-state')
    const found = getFilterConfig(id)
    if (!found) notFound()
    config = found as LibraryFilterConfig
  } else {
    const res = await fetch(getApiUrl(`library/filter/${id}`), { cache: 'no-store' })
    if (!res.ok) notFound()
    config = await res.json()
  }

  return <FilterConfigDetail config={config} usedBy={usedBy} />
}
