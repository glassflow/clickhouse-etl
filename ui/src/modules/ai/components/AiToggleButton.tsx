// Floating toggle button + ⌘K / Ctrl+K global shortcut. Lives in the
// sidebar but the keydown listener is attached to `window` so the shortcut
// fires from anywhere in the app.

'use client'

import * as React from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { SparklesIcon } from 'lucide-react'
import { KbdHint } from '@/src/components/ui/kbd-hint'

type AiToggleButtonProps = {
  compact?: boolean
}

export function AiToggleButton({ compact = false }: AiToggleButtonProps) {
  const { aiUiStore } = useStore()
  const toggleDrawer = aiUiStore.toggleDrawer

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore the shortcut when the user is typing in an input/textarea —
      // it would clash with browser defaults (e.g. Cmd+K → spotlight).
      // We still let it through when the focus is on body/non-editable.
      const target = e.target as HTMLElement | null
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (isEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleDrawer()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleDrawer])

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDrawer}
        aria-label="Open AI assistant (⌘K)"
      >
        <SparklesIcon size={15} />
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggleDrawer}
      className="gap-1.5 w-full justify-start"
      aria-label="Open AI assistant"
    >
      <SparklesIcon size={14} />
      <span>Ask AI</span>
      <KbdHint keys={['⌘', 'K']} className="ml-auto" />
    </Button>
  )
}
