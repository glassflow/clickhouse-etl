import type { ReactNode } from 'react'
import { ShellLayoutClient } from '@/src/components/shared/ShellLayoutClient'

export default function ShellLayout({ children }: { children: ReactNode }) {
  // Read AI key availability server-side — never expose raw keys to the client
  const aiEnabled = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)

  return <ShellLayoutClient aiEnabled={aiEnabled}>{children}</ShellLayoutClient>
}
