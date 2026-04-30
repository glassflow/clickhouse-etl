import { NextResponse } from 'next/server'
import { getLibraryLinks } from './_lib'

export type { LibraryLink, DriftLevel } from './_lib'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /ui-api/pipelines/:id/library-links
 *
 * Returns the references on the pipeline's *latest* revision joined against
 * each resource's name and (for schemas/transforms) the latest published
 * version, with a computed `drift` level per row.
 */
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const result = await getLibraryLinks(id)
  return NextResponse.json(result)
}
