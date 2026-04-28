'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Card } from '@/src/components/ui/card'

interface SaveToLibraryPromptProps {
  connectionType: 'kafka' | 'clickhouse'
  onSave: (name: string) => Promise<void>
  onDismiss: () => void
}

export function SaveToLibraryPrompt({ connectionType, onSave, onDismiss }: SaveToLibraryPromptProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = connectionType === 'kafka' ? 'Kafka connection' : 'ClickHouse connection'

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
      setSaved(true)
      setTimeout(onDismiss, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Card variant="dark" className="p-3 flex items-center gap-2 mt-3">
        <span className="caption-1 text-[var(--color-foreground-positive)]">
          {label} saved to Library.
        </span>
      </Card>
    )
  }

  return (
    <Card variant="dark" className="p-3 flex flex-col gap-2 mt-3">
      <div className="flex items-center justify-between">
        <span className="caption-1 text-[var(--text-secondary)]">Save this {label} to Library for reuse</span>
        <Button variant="ghost" size="icon" onClick={onDismiss} className="h-5 w-5 shrink-0">
          <XMarkIcon className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={`e.g. ${connectionType === 'kafka' ? 'kafka-prod' : 'clickhouse-staging'}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          className="h-8 text-sm"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          loading={saving}
          loadingText="Saving…"
          disabled={!name.trim()}
        >
          Save
        </Button>
      </div>
      {error && <span className="caption-1 text-[var(--color-foreground-critical)]">{error}</span>}
    </Card>
  )
}
