// Tiny client wrapper that mounts the AI drawer at the app root. The drawer
// itself uses Radix's `DialogPortal` (via the `Drawer` primitive) which
// already escapes the DOM tree — this wrapper only exists to keep the
// `'use client'` boundary out of the server-rendered root layout.

'use client'

import { AiDrawer } from '@/src/modules/ai/components/AiDrawer'

export function AiDrawerMount() {
  return <AiDrawer />
}
