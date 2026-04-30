// Empty-state suggestion chips — clicking one fills the input draft so the
// user can edit before sending.

'use client'

import { Pill } from '@/src/components/ui/pill'

const SUGGESTIONS = [
  'Build a pipeline from Kafka topic "orders" to ClickHouse table "orders_normalized"',
  'Show me my schemas',
  'Why is my pipeline showing drift?',
  'Add a deduplication step on order_id',
]

type SuggestionChipsProps = { onPick: (text: string) => void }

export function SuggestionChips({ onPick }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTIONS.map((s) => (
        <Pill key={s} onSelect={() => onPick(s)}>
          {s}
        </Pill>
      ))}
    </div>
  )
}
