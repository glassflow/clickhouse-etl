import type { ReactNode } from 'react'
import { ShellLayoutClient } from '@/src/components/shared/ShellLayoutClient'
import { isAiEnabled } from '@/src/utils/auth-config.server'

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <ShellLayoutClient aiEnabled={isAiEnabled()}>{children}</ShellLayoutClient>
}
