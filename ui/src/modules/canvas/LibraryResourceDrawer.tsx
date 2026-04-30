'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'

type Kind = 'connection' | 'schema' | 'transform'

type LibraryResourceDrawerProps = {
  open: boolean
  onClose: () => void
  kind: Kind
  resourceId: string | null
  pinnedVersion?: string
  // Pre-resolved data passed in (parent uses Library hooks to resolve)
  resourceName?: string
  resourceConfigJson?: string
  detailHref: string // /library/.../<id>
}

export function LibraryResourceDrawer({
  open,
  onClose,
  kind,
  resourceId,
  pinnedVersion,
  resourceName,
  resourceConfigJson,
  detailHref,
}: LibraryResourceDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{resourceName ?? resourceId}</DrawerTitle>
          <DrawerDescription>
            {kind} {pinnedVersion ? <span className="mono-2 ml-2">{pinnedVersion}</span> : null}
          </DrawerDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{kind === 'connection' ? 'live' : 'pinned'}</Badge>
            {pinnedVersion && <Badge variant="secondary">pinned: {pinnedVersion}</Badge>}
          </div>
        </DrawerHeader>
        <DrawerBody>
          {resourceConfigJson ? (
            <pre className="mono-2 rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] p-3 text-[var(--color-foreground-neutral-faded)] overflow-x-auto">
              {resourceConfigJson}
            </pre>
          ) : (
            <p className="body-3 text-[var(--text-secondary)] animate-pulse">Loading…</p>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href={detailHref}>Open in Library →</Link>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
