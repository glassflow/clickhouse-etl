'use client'

import { DashboardPage } from '@/src/modules/dashboard/components/DashboardPage'
import type { DashboardState } from '@/src/modules/dashboard/types'

type Props = { state: DashboardState }

export function DashboardClient({ state }: Props) {
  return <DashboardPage state={state} />
}
