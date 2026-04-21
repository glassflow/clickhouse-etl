'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sections = [
  { href: '/dev/components', label: 'Overview', exact: true },
  { href: '/dev/components/foundations', label: 'Foundations' },
  { href: '/dev/components/buttons', label: 'Buttons' },
  { href: '/dev/components/display', label: 'Display' },
  { href: '/dev/components/forms', label: 'Forms' },
  { href: '/dev/components/overlays', label: 'Overlays' },
  { href: '/dev/components/navigation', label: 'Navigation' },
  { href: '/dev/components/feedback', label: 'Feedback' },
]

export function GalleryNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-8 flex flex-col gap-0.5">
      <p className="body-3 text-[var(--text-secondary)] uppercase tracking-widest mb-3 px-3 font-medium">
        Components
      </p>
      {sections.map(({ href, label, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={[
              'relative flex items-center px-3 py-2 rounded-md body-3 transition-colors',
              isActive
                ? 'text-[var(--color-foreground-primary)] bg-[var(--color-background-primary-faded)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover-bg)]',
            ].join(' ')}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--color-foreground-primary)]" />
            )}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
