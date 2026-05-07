import { notFound, redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { getApiUrl } from '@/src/utils/mock-api'
import { SchemaDetail } from '@/src/modules/library/components/SchemaDetail'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

type PageProps = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SchemaDetailPage({ params }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { id } = await params

  let schema: LibrarySchema
  let usedBy: UsedByEntry[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
    const { getSchema, getSchemaUsedBy } = await import('@/src/app/ui-api/mock/data/library-state')
    const raw = getSchema(id)
    if (!raw) notFound()
    schema = raw as LibrarySchema
    usedBy = getSchemaUsedBy(id) as UsedByEntry[]
  } else {
    const [schemaRes, usedByRes] = await Promise.all([
      fetch(getApiUrl(`library/schemas/${id}`), { cache: 'no-store' }),
      fetch(getApiUrl(`library/schemas/${id}/used-by`), { cache: 'no-store' }),
    ])
    if (!schemaRes.ok) notFound()
    schema = await schemaRes.json()
    if (usedByRes.ok) {
      const body = await usedByRes.json()
      usedBy = body.usedBy ?? []
    }
  }

  return <SchemaDetail schema={schema} usedBy={usedBy} />
}
