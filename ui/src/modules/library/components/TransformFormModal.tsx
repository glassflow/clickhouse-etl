'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import type { LibraryTransform } from '@/src/hooks/useLibraryConnections'
import { notify } from '@/src/notifications'
import { getApiUrl } from '@/src/utils/mock-api'

type TransformFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  transform?: LibraryTransform | null
}

export function TransformFormModal({
  open,
  onClose,
  onSaved,
  transform,
}: TransformFormModalProps) {
  const editing = Boolean(transform)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [language, setLanguage] = React.useState<'js' | 'sql'>('js')
  const [code, setCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(transform?.name ?? '')
      setDescription(transform?.description ?? '')
      setLanguage(transform?.language ?? 'js')
      setCode(transform?.code ?? '')
    }
  }, [open, transform])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const url = editing
        ? getApiUrl(`library/transforms/${transform!.id}`)
        : getApiUrl('library/transforms')
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          language,
          code,
          tags: [],
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: unknown } | null
        notify({
          variant: 'error',
          title: 'Save failed',
          description: err?.error ? JSON.stringify(err.error) : 'Unknown error',
        })
        return
      }
      notify({
        variant: 'success',
        title: editing ? 'Transform updated' : 'Transform created',
      })
      onSaved()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="modal-title title-4 text-[var(--text-primary)]">
            {editing ? 'Edit transform' : 'New transform'}
          </DialogTitle>
          <DialogDescription className="modal-description">
            Reusable transform. Pipelines pin a specific version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="modal-input-label">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. normalize-orders"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="modal-input-label">Description</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this transform do?"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="modal-input-label">Language</label>
            <Select value={language} onValueChange={(v: string) => setLanguage(v as 'js' | 'sql')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="js">JavaScript</SelectItem>
                <SelectItem value="sql">SQL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="modal-input-label">Code</label>
            <Textarea
              className="mono-1"
              rows={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                language === 'js' ? '// (event) => event' : '-- SELECT … FROM input'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            loadingText="Saving…"
            disabled={!name || !code}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
