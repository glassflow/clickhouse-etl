// Model selector — Haiku/Sonnet/Opus. Display only; the selected id is sent
// with each `/ui-api/ai/chat` POST.

'use client'

import { useStore } from '@/src/store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
]

export function ModelPicker() {
  const { aiUiStore } = useStore()
  return (
    <Select value={aiUiStore.modelId} onValueChange={aiUiStore.setModel}>
      <SelectTrigger className="h-7 caption-1 mono-2 w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id} className="caption-1 mono-2">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
