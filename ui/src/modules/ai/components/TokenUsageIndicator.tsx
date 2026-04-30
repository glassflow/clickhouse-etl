// Token usage indicator — counts in/out tokens reported by Anthropic on each
// turn (via the `tokens_used` field on `message_stop` SSE events). The
// counter resets when the page reloads — it tracks the current SDK session,
// not the persisted total stored in `ai_chats.tokens_used`.

'use client'

import { useStore } from '@/src/store'

export function TokenUsageIndicator() {
  const { aiUiStore } = useStore()
  const tokens = aiUiStore.tokensUsedThisSession
  const display = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`
  return (
    <span
      className="caption-1 mono-2 text-[var(--text-tertiary)]"
      title={`${tokens} tokens this session`}
    >
      {display} tok
    </span>
  )
}
