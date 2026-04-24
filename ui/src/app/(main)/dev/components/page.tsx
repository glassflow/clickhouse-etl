import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'

const categories = [
  {
    href: '/dev/components/foundations',
    title: 'Foundations',
    description: 'Typography scale, color tokens, spacing, and border radius',
    count: 'Typography · Colors · Spacing',
  },
  {
    href: '/dev/components/buttons',
    title: 'Buttons',
    description: 'All button variants, sizes, states, and the loading pattern',
    count: '11 variants · 6 sizes',
  },
  {
    href: '/dev/components/display',
    title: 'Display',
    description: 'Cards, badges, avatars, and tables for showing data',
    count: 'Card · Badge · Avatar · Table',
  },
  {
    href: '/dev/components/forms',
    title: 'Forms',
    description: 'Inputs, selects, checkboxes, switches, labels, and textarea',
    count: 'Input · Select · Checkbox · Switch',
  },
  {
    href: '/dev/components/overlays',
    title: 'Overlays',
    description: 'Dialog, tooltip, popover, and dropdown menu patterns',
    count: 'Dialog · Tooltip · Popover · Dropdown',
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
    description: 'Alert variants and animation utility classes',
    count: 'Alert · Animations',
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
          <Link
            key={href}
            href={href}
            className="group card-dark p-5 rounded-xl flex flex-col gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="title-6 text-[var(--text-primary)]">{title}</h2>
                <p className="body-3 text-[var(--text-secondary)] mt-1">{description}</p>
              </div>
              <ArrowRightIcon className="size-4 text-[var(--text-secondary)] shrink-0 mt-0.5 group-hover:text-[var(--color-foreground-primary)] transition-colors" />
            </div>
            <p className="text-xs text-[var(--color-foreground-primary-faded)] font-mono">{count}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
