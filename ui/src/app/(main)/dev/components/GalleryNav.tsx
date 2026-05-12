'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SearchIcon } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/src/components/ui/command'

// ─── Sections (sidebar nav) ────────────────────────────────────────────────────

const sections = [
  { href: '/dev/components', label: 'Overview', exact: true },
  { href: '/dev/components/foundations', label: 'Foundations' },
  { href: '/dev/components/buttons', label: 'Buttons' },
  { href: '/dev/components/display', label: 'Display' },
  { href: '/dev/components/shell', label: 'Shell' },
  { href: '/dev/components/forms', label: 'Forms' },
  { href: '/dev/components/overlays', label: 'Overlays' },
  { href: '/dev/components/navigation', label: 'Navigation' },
  { href: '/dev/components/feedback', label: 'Feedback' },
  { href: '/dev/components/utilities', label: 'Utilities' },
  { href: '/dev/components/drawers', label: 'Drawers & Modals' },
  { href: '/dev/components/patterns', label: 'Patterns' },
  { href: '/dev/components/anti-patterns', label: 'Anti-patterns' },
]

// ─── Cmd-K search index ────────────────────────────────────────────────────────

type SearchEntry = {
  label: string
  href: string
  group: 'Sections' | 'Components' | 'Tokens' | 'Variants'
  hint?: string
}

const components: SearchEntry[] = [
  // Buttons
  {
    label: 'Button',
    href: '/dev/components/buttons',
    group: 'Components',
    hint: 'primary · destructive · outline · ghost · gradient',
  },
  // Display
  { label: 'Badge', href: '/dev/components/display', group: 'Components', hint: 'success · warning · error · outline' },
  { label: 'Card', href: '/dev/components/display', group: 'Components', hint: 'dark · outline · elevated · feedback' },
  {
    label: 'DataTable',
    href: '/dev/components/display',
    group: 'Components',
    hint: 'sortable · density · rowStatus · sortComparator',
  },
  { label: 'Sparkline', href: '/dev/components/display', group: 'Components' },
  { label: 'EmptyState', href: '/dev/components/display', group: 'Components' },
  { label: 'Table (Radix)', href: '/dev/components/display', group: 'Components' },
  { label: 'Avatar', href: '/dev/components/display', group: 'Components' },
  // Shell
  {
    label: 'PageShell',
    href: '/dev/components/shell',
    group: 'Components',
    hint: 'title · subtitle · crumbs · actions · sidebar · filters · status',
  },
  { label: 'Crumbs', href: '/dev/components/shell', group: 'Components' },
  // Forms
  { label: 'Input', href: '/dev/components/forms', group: 'Components', hint: 'variant: default · error' },
  { label: 'Select', href: '/dev/components/forms', group: 'Components' },
  { label: 'Checkbox', href: '/dev/components/forms', group: 'Components' },
  { label: 'Switch', href: '/dev/components/forms', group: 'Components' },
  { label: 'Textarea', href: '/dev/components/forms', group: 'Components' },
  { label: 'Label', href: '/dev/components/forms', group: 'Components' },
  // Overlays
  { label: 'Dialog', href: '/dev/components/overlays', group: 'Components' },
  { label: 'Popover', href: '/dev/components/overlays', group: 'Components' },
  { label: 'DropdownMenu', href: '/dev/components/overlays', group: 'Components' },
  { label: 'Tooltip', href: '/dev/components/overlays', group: 'Components' },
  { label: 'Command (Cmd-K)', href: '/dev/components/overlays', group: 'Components' },
  // Navigation
  { label: 'Tabs', href: '/dev/components/navigation', group: 'Components' },
  { label: 'Accordion', href: '/dev/components/navigation', group: 'Components' },
  // Feedback
  { label: 'Skeleton', href: '/dev/components/feedback', group: 'Components' },
  { label: 'Sonner (Toast)', href: '/dev/components/feedback', group: 'Components' },
  { label: 'Form (FormField, FormMessage)', href: '/dev/components/feedback', group: 'Components' },
]

const variants: SearchEntry[] = [
  { label: 'Button variant="primary"', href: '/dev/components/buttons', group: 'Variants' },
  { label: 'Button variant="destructive"', href: '/dev/components/buttons', group: 'Variants' },
  { label: 'Button variant="ghost"', href: '/dev/components/buttons', group: 'Variants' },
  { label: 'Button variant="gradient"', href: '/dev/components/buttons', group: 'Variants' },
  { label: 'Card variant="dark"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Card variant="outline"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Card variant="elevated"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Badge variant="success"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Badge variant="warning"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Badge variant="error"', href: '/dev/components/display', group: 'Variants' },
  { label: 'Input variant="error"', href: '/dev/components/forms', group: 'Variants' },
  { label: 'DataTable density="compact"', href: '/dev/components/display', group: 'Variants' },
  { label: 'DataTable rowStatus="critical"', href: '/dev/components/display', group: 'Variants' },
]

const tokens: SearchEntry[] = [
  {
    label: '--color-foreground-critical',
    href: '/dev/components/foundations',
    group: 'Tokens',
    hint: 'failed status, error text',
  },
  {
    label: '--color-foreground-warning',
    href: '/dev/components/foundations',
    group: 'Tokens',
    hint: 'degraded, paused',
  },
  {
    label: '--color-foreground-positive',
    href: '/dev/components/foundations',
    group: 'Tokens',
    hint: 'success, healthy',
  },
  { label: '--color-foreground-info', href: '/dev/components/foundations', group: 'Tokens', hint: 'neutral info' },
  { label: '--color-background-critical-faded', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--color-background-warning-faded', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--color-background-positive-faded', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--color-red-alpha-5 / 10 / 20', href: '/dev/components/foundations', group: 'Tokens', hint: 'row tints' },
  {
    label: '--color-orange-alpha-5 / 10 / 20',
    href: '/dev/components/foundations',
    group: 'Tokens',
    hint: 'selection backgrounds',
  },
  { label: '--text-primary', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--text-secondary', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--text-tertiary', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--surface-bg', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--surface-bg-sunken', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--surface-bg-hover', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--surface-border', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--control-shadow-focus', href: '/dev/components/foundations', group: 'Tokens', hint: 'focus ring' },
  { label: '--control-border-error', href: '/dev/components/foundations', group: 'Tokens' },
  { label: '--shell-max-width', href: '/dev/components/shell', group: 'Tokens', hint: '1920px default' },
]

const searchIndex: SearchEntry[] = [
  ...sections.map((s) => ({ label: s.label, href: s.href, group: 'Sections' as const })),
  ...components,
  ...variants,
  ...tokens,
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function GalleryNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Cmd+K / Ctrl+K opens the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSelect = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  // Group entries for the dialog
  const grouped: Record<SearchEntry['group'], SearchEntry[]> = {
    Sections: [],
    Components: [],
    Variants: [],
    Tokens: [],
  }
  for (const entry of searchIndex) grouped[entry.group].push(entry)

  return (
    <nav className="sticky top-8 flex flex-col gap-0.5">
      <p className="body-3 text-[var(--text-secondary)] uppercase tracking-widest mb-3 px-3 font-medium">Components</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md body-3 text-[var(--text-secondary)] border border-[var(--surface-border)] hover:border-[var(--color-gray-dark-500)] hover:text-[var(--text-primary)] transition-colors text-left focus:shadow-[var(--control-shadow-focus)] focus:outline-none"
        aria-label="Open search palette (Cmd+K)"
      >
        <SearchIcon size={14} className="shrink-0 opacity-60" />
        <span className="flex-1">Search…</span>
        <kbd className="caption-1 font-mono text-[var(--text-tertiary)] border border-[var(--surface-border)] rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

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

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Component search"
        description="Find components, variants, and design tokens."
      >
        <CommandInput placeholder="Search components, variants, tokens…" />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>
          {(['Sections', 'Components', 'Variants', 'Tokens'] as const).map((group) =>
            grouped[group].length > 0 ? (
              <CommandGroup key={group} heading={group}>
                {grouped[group].map((entry) => (
                  <CommandItem
                    key={`${group}:${entry.label}`}
                    value={`${entry.label} ${entry.hint ?? ''}`}
                    onSelect={() => onSelect(entry.href)}
                  >
                    <span className="font-mono text-sm">{entry.label}</span>
                    {entry.hint && (
                      <span className="ml-auto caption-1 text-[var(--text-tertiary)] truncate max-w-[280px]">
                        {entry.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null,
          )}
        </CommandList>
      </CommandDialog>
    </nav>
  )
}
