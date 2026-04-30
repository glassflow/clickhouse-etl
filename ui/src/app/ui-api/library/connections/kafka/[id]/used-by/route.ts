import { NextResponse } from 'next/server'
import { findPipelinesUsingKafkaConnection } from '../../../../_lib/used-by'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  try {
    const usedBy = await findPipelinesUsingKafkaConnection(id)
    return NextResponse.json({ usedBy })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
