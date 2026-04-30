'use client'

import * as React from 'react'
import { useStore } from '@/src/store'

/**
 * Mounts a `beforeunload` listener that prompts the user when there are
 * unsaved canvas edits (`canvasStore.isDirty === true`).
 *
 * Note: Next.js App Router does not yet expose programmatic interception of
 * in-app `<Link>` clicks. We rely on `beforeunload` for full reloads and
 * external navigations away from the SPA. For in-app navigation, the Phase 2
 * DeployBar's "Discard" pattern is shown only when the user explicitly opts
 * in. This is an accepted simplification documented in the Phase 8 plan.
 */
export function UnsavedChangesGuard() {
  const { canvasStore } = useStore()
  const isDirty = canvasStore.isDirty

  React.useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers show a generic "leave site?" prompt regardless of the
      // value here; older browsers expect a non-empty `returnValue`.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return null
}
