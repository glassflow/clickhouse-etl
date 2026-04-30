'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LogLine as LogLineType } from '@/src/hooks/useLogsQuery'

type LogInspectorDrawerProps = {
  line: LogLineType | null
  pipelineId: string
  onClose: () => void
}

const STRUCTURED_KEYS_FIRST = ['_time', '_msg', 'severity', 'component', 'trace_id', 'span_id']

/**
 * Right-side drawer that renders a single log line's structured fields.
 *
 * Sorts keys with the canonical `_time / _msg / severity / component /
 * trace_id / span_id` block first, then alphabetical for everything else.
 * Trace and library cross-cutting links live in the footer.
 */
export function LogInspectorDrawer({ line, pipelineId, onClose }: LogInspectorDrawerProps) {
  const open = line !== null
  const entries = line
    ? Object.entries(line).sort((a, b) => {
        const ai = STRUCTURED_KEYS_FIRST.indexOf(a[0])
        const bi = STRUCTURED_KEYS_FIRST.indexOf(b[0])
        const aRank = ai === -1 ? 999 : ai
        const bRank = bi === -1 ? 999 : bi
        if (aRank !== bRank) return aRank - bRank
        return a[0].localeCompare(b[0])
      })
    : []

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Log line</DrawerTitle>
          <div className="flex items-center gap-2 mt-2">
            {line?.severity && <Badge variant="secondary">{String(line.severity)}</Badge>}
            {line?.component && <Badge variant="outline">{String(line.component)}</Badge>}
          </div>
        </DrawerHeader>

        <DrawerBody>
          <div className="flex flex-col gap-3">
            <pre className="mono-1 text-[var(--text-primary)] whitespace-pre-wrap rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] p-3">
              {line?._msg}
            </pre>

            <table className="w-full text-left">
              <tbody className="divide-y divide-[var(--surface-border)]">
                {entries.map(([k, v]) => (
                  <tr key={k}>
                    <td className="caption-1 text-[var(--text-tertiary)] py-1.5 pr-3 align-top w-[140px] mono-2">
                      {k}
                    </td>
                    <td className="mono-2 text-[var(--text-primary)] py-1.5 break-all">
                      {formatVal(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerBody>

        <DrawerFooter>
          {line?.trace_id ? (
            <Button asChild variant="ghost" size="sm">
              <a href={`#trace-${String(line.trace_id)}`}>View trace →</a>
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/pipelines/${pipelineId}/library-links`}>Open library links →</Link>
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function formatVal(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}
