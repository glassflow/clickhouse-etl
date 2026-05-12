import { cn } from '@/src/utils/common.client'
import type { ActivityItem } from '../types'

const DOT_CLS: Record<string, string> = {
  deploy: 'bg-[var(--color-green-500)]',
  pause:  'bg-[var(--color-yellow-400)]',
  fail:   'bg-[var(--color-red-500)]',
  info:   'bg-[var(--color-blue-500)]',
}

const CARD = 'bg-[var(--dash-card-bg)] border border-[var(--color-gray-dark-700)] rounded-[10px] flex flex-col overflow-hidden'
const CARD_H = 'flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--color-gray-dark-800)]'
const LINK_BTN = 'text-[11.5px] text-[var(--color-gray-dark-100)] font-mono cursor-pointer bg-transparent border-0 p-0 hover:text-[var(--color-orange-300)] transition-colors duration-[120ms] focus-ring'

type Props = { items: ActivityItem[]; showViewLog?: boolean }

export function ActivityFeed({ items, showViewLog = true }: Props) {
  return (
    <div className={CARD}>
      <div className={CARD_H}>
        <h3 className="title-6 font-semibold m-0 tracking-[-0.005em] text-[var(--color-foreground-neutral)]">
          Recent activity
        </h3>
        {showViewLog && (
          <button className={LINK_BTN} type="button">View log →</button>
        )}
      </div>

      <div className="flex flex-col">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[16px_1fr_auto] gap-3 px-[18px] py-[11px] items-center border-b border-[var(--color-gray-dark-800)] last:border-b-0 text-[12px]"
          >
            <span
              className={cn('w-1.5 h-1.5 rounded-full mx-auto', DOT_CLS[item.kind] ?? 'bg-[var(--color-gray-dark-500)]')}
              data-kind={item.kind}
              aria-hidden="true"
            />
            <div className="text-[var(--color-gray-100)] leading-snug">
              {item.actor && <b className="text-[var(--color-foreground-neutral)] font-semibold">{item.actor}</b>}
              {item.actor && ' '}
              {item.text}
            </div>
            <div className="font-mono text-[10.5px] text-[var(--color-gray-dark-500)]">{item.relativeTime}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
