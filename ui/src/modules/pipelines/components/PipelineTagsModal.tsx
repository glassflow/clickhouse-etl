'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Badge } from '@/src/components/ui/badge'
import { X, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

interface PipelineTagsModalProps {
  visible: boolean
  pipelineName: string
  initialTags?: string[]
  onSave: (tags: string[]) => Promise<void> | void
  onCancel: () => void
  isSaving?: boolean
}

const MAX_TAG_LENGTH = 64

export function PipelineTagsModal({
  visible,
  pipelineName,
  initialTags = [],
  onSave,
  onCancel,
  isSaving = false,
}: PipelineTagsModalProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (visible) {
      setTags(initialTags)
      setInputValue('')
    }
  }, [visible, initialTags])

  const normalizedInput = inputValue.trim()

  const canSave = useMemo(() => {
    const normalizedInitial = (initialTags || [])
      .map((tag) => tag.toLowerCase())
      .sort()
      .join(',')
    const normalizedCurrent = tags
      .map((tag) => tag.toLowerCase())
      .sort()
      .join(',')
    return normalizedInitial !== normalizedCurrent
  }, [initialTags, tags])

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim()
    if (!normalizedTag) return
    if (normalizedTag.length > MAX_TAG_LENGTH) return

    setTags((prev) => {
      if (prev.includes(normalizedTag)) {
        return prev
      }
      return [...prev, normalizedTag]
    })
    setInputValue('')
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault()
      if (normalizedInput) {
        addTag(normalizedInput.replace(/,$/, ''))
      }
    } else if (event.key === 'Backspace' && !inputValue) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text')
    pasted
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => addTag(tag))
  }

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((current) => current !== tag))
  }

  const handleSave = async () => {
    await onSave(tags)
  }

  return (
    <Dialog
      open={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSaving) {
          onCancel()
        }
      }}
    >
      <DialogOverlay
        className="!fixed !inset-0"
        aria-hidden="true"
        style={{
          backgroundColor: 'rgba(17, 25, 40, 0.25)',
          backdropFilter: 'blur(4px) saturate(30%)',
          WebkitBackdropFilter: 'blur(4px) saturate(30%)',
          border: '1px solid rgba(255, 255, 255, 0.125)',
        }}
      />
      <DialogContent className="sm:max-w-[520px] info-modal-container surface-gradient-border border-0">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-8">
            <TagIcon className="h-4 w-4" />
            Manage tags
          </DialogTitle>
          <DialogDescription className="modal-description text-sm mb-4">
            Add descriptive tags to <span className="font-medium text-foreground">{pipelineName}</span> to help with
            filtering and discovery. Press Enter after each tag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Tags</label>
            <div
              className={cn(
                'flex flex-wrap gap-2 p-2 rounded-md border border-[var(--color-border-neutral)] bg-[var(--color-background-neutral-faded)]',
                'min-h-[48px]',
              )}
            >
              {/* {tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>} */}
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1 rounded-full px-2 py-1 text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-foreground transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onPaste={handlePaste}
                placeholder="Type a tag and press Enter"
                className="flex-1 min-w-[120px] border-none shadow-none focus-visible:ring-0 bg-transparent px-0"
                maxLength={MAX_TAG_LENGTH}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Max {MAX_TAG_LENGTH} characters per tag.</p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="tertiary" size="custom" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" size="custom" onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Saving…' : 'Save tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PipelineTagsModal
