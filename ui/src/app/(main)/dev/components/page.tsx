import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { Card } from '@/src/components/ui/card'

const categories = [
  {
    href: '/dev/components/foundations',
    title: 'Foundations',
    description: 'All type scales, semantic colors, surface / option / shadow tokens, spacing, and z-index',
    count: 'Title · Featured · Body · Caption · Mono · Colors · Tokens',
  },
  {
    href: '/dev/components/buttons',
    title: 'Buttons',
    description: 'All button variants, sizes, states, and the loading pattern',
    count: '11 variants · 7 sizes',
  },
  {
    href: '/dev/components/display',
    title: 'Display',
    description: 'Cards (all 9 variants + all 4 state modifiers), badges, avatars, and tables',
    count: 'Card · Badge · Avatar · Table',
  },
  {
    href: '/dev/components/forms',
    title: 'Forms',
    description: 'Inputs, selects, checkboxes, switches, labels, textarea, and InputGroup',
    count: 'Input · Select · Checkbox · Switch · InputGroup',
  },
  {
    href: '/dev/components/overlays',
    title: 'Overlays',
    description: 'Dialog, tooltip, popover, dropdown, calendar date picker, and command palette',
    count: 'Dialog · Tooltip · Popover · Dropdown · Calendar · Command',
  },
  {
    href: '/dev/components/navigation',
    title: 'Navigation',
    description: 'Tabs and accordion for organizing content',
    count: 'Tabs · Accordion',
  },
  {
    href: '/dev/components/feedback',
    title: 'Feedback',
    description: 'Alert variants, toast notifications, and all 14 animation utility classes',
    count: 'Alert · Toast · Animations',
  },
  {
    href: '/dev/components/utilities',
    title: 'Utilities',
    description: 'Skeleton loaders, empty states, pills, sparklines, indicators, and TimeRangePicker',
    count: 'Skeleton · EmptyState · Pill · Sparkline · LiveIndicator · KbdHint · Crumbs · ScopeBadge · TimeRangePicker',
  },
  {
    href: '/dev/components/drawers',
    title: 'Drawers & Modals',
    description: 'Drawer, Sheet, and all modal dialog patterns with canonical usage examples',
    count: 'Drawer · Sheet · ConfirmationModal · InfoModal · Modal shell',
  },
]

export default function ComponentsOverviewPage() {
  return (
    <div>
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)] mb-4">
          <span className="text-xs text-[var(--color-foreground-primary)] font-medium uppercase tracking-widest">
            Dev Tools
          </span>
        </div>
        <h1 className="title-2 text-[var(--text-accent)]">Component Gallery</h1>
        <p className="body-2 text-[var(--text-secondary)] mt-2 max-w-lg">
          A reference for every UI primitive and pattern in the GlassFlow design system. Components are shown with all
          variants, states, and token usage.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map(({ href, title, description, count }) => (
          <Card key={href} variant="dark" className="group rounded-xl hover:opacity-90 transition-opacity">
            <Link href={href} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="title-6 text-[var(--text-primary)]">{title}</h2>
                  <p className="body-3 text-[var(--text-secondary)] mt-1">{description}</p>
                </div>
                <ArrowRightIcon className="size-4 text-[var(--text-secondary)] shrink-0 mt-0.5 group-hover:text-[var(--color-foreground-primary)] transition-colors" />
              </div>
              <p className="text-xs text-[var(--color-foreground-primary-faded)] font-mono">{count}</p>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
