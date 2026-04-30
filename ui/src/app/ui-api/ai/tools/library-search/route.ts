// Tool: library_search
//
// Substring-matches the user's saved Library resources (connections, schemas,
// transforms) by name. The chat route invokes this when the model issues a
// `library_search` tool_use block; the result is also rendered inline in the
// drawer as a `LibrarySearchCard`.

import { NextResponse } from 'next/server'
import { ilike } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import {
  schemas,
  transforms,
  kafkaConnections,
  clickhouseConnections,
} from '@/src/lib/db/schema'

type LibrarySearchKind =
  | 'schema'
  | 'transform'
  | 'kafka_connection'
  | 'clickhouse_connection'

type LibrarySearchBody = {
  query: string
  kinds?: LibrarySearchKind[]
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Partial<LibrarySearchBody>
  const query = (body.query ?? '').trim()
  if (!query) return NextResponse.json({ results: [] })

  const wanted = new Set<LibrarySearchKind>(
    body.kinds ?? ['schema', 'transform', 'kafka_connection', 'clickhouse_connection'],
  )
  const ilq = `%${query}%`

  const [s, t, k, c] = await Promise.all([
    wanted.has('schema')
      ? db
          .select({ id: schemas.id, name: schemas.name })
          .from(schemas)
          .where(ilike(schemas.name, ilq))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    wanted.has('transform')
      ? db
          .select({
            id: transforms.id,
            name: transforms.name,
            language: transforms.language,
          })
          .from(transforms)
          .where(ilike(transforms.name, ilq))
      : Promise.resolve(
          [] as Array<{ id: string; name: string; language: string | null }>,
        ),
    wanted.has('kafka_connection')
      ? db
          .select({ id: kafkaConnections.id, name: kafkaConnections.name })
          .from(kafkaConnections)
          .where(ilike(kafkaConnections.name, ilq))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    wanted.has('clickhouse_connection')
      ? db
          .select({ id: clickhouseConnections.id, name: clickhouseConnections.name })
          .from(clickhouseConnections)
          .where(ilike(clickhouseConnections.name, ilq))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ])

  return NextResponse.json({
    results: [
      ...s.map((x) => ({ kind: 'schema' as const, ...x })),
      ...t.map((x) => ({ kind: 'transform' as const, ...x })),
      ...k.map((x) => ({ kind: 'kafka_connection' as const, ...x })),
      ...c.map((x) => ({ kind: 'clickhouse_connection' as const, ...x })),
    ],
  })
}
