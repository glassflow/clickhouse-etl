'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import logoFullName from '../../images/logo-full-name.svg'
import { Button } from '@/src/components/ui/button'
import { AiToggleButton } from '@/src/modules/ai/components/AiToggleButton'
import { PlatformBadge } from './PlatformBadge'
import { NotificationBadge } from './NotificationBadge'
import { UserSection } from './UserSection'
import { getRuntimeEnv } from '@/src/utils/common.client'
import {
  LayoutDashboardIcon,
  WorkflowIcon,
  LibraryBigIcon,
  ActivityIcon,
  PlusIcon,
  BookOpenIcon,
  MessageCircleIcon,
  BugIcon,
  ChevronDownIcon,
  MenuIcon,
  XIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  matchPaths?: string[]
}

const primaryNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboardIcon size={14} />,
    matchPaths: ['/dashboard'],
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    icon: <WorkflowIcon size={14} />,
    matchPaths: ['/pipelines'],
  },
  {
    href: '/library',
    label: 'Library',
    icon: <LibraryBigIcon size={14} />,
    matchPaths: ['/library'],
  },
  {
    href: '/workspace/observability',
    label: 'Observability',
    icon: <ActivityIcon size={14} />,
    matchPaths: ['/workspace/observability', '/observability'],
  },
]

// ─── Help dropdown ────────────────────────────────────────────────────────────

function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((v) => !v)}
        className="gap-1.5 body-3"
        aria-expanded={isOpen}
        aria-label="Help menu"
      >
        Help
        <ChevronDownIcon
          size={13}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--color-background-elevation-raised-faded-2)] surface-gradient-border rounded-md shadow-lg py-1 z-50">
          <a
            href="https://docs.glassflow.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <BookOpenIcon size={13} />
            View Docs
          </a>
          <a
            href="https://www.glassflow.dev/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <MessageCircleIcon size={13} />
            Contact Us
          </a>
          <a
            href="https://github.com/glassflow/clickhouse-etl/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <BugIcon size={13} />
            Report an Issue
          </a>
        </div>
      )}
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

type AppTopbarProps = {
  onCreateClick?: () => void
}

export function AppTopbar({ onCreateClick }: AppTopbarProps) {
  const pathname = usePathname()
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileMenuOpen])

  const isActive = (item: NavItem): boolean => {
    const paths = item.matchPaths ?? [item.href]
    return paths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <header
      className="sticky top-0 z-50 h-14 flex-shrink-0 flex items-center border-b border-[var(--surface-border)] bg-[var(--elevated-background)]"
      aria-label="Application navigation"
    >
      <div className="flex items-center w-full max-w-[var(--shell-max-width)] mx-auto px-6 gap-8 h-full">
        {/* Logo */}
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className="flex items-center shrink-0 pr-8 border-r border-[var(--surface-border)] h-full"
        >
          <Image
            src={logoFullName}
            alt="Glassflow"
            width={130}
            height={28}
            className="w-auto h-[18px]"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center h-full gap-1 flex-1" aria-label="Main navigation">
          {primaryNavItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative flex items-center gap-1.5 h-full px-3 body-3 transition-colors whitespace-nowrap',
                  active
                    ? 'text-[var(--color-foreground-primary)]'
                    : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--color-orange-300)]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            )
          })}

          {/* Create button — placed after nav items per design */}
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5 ml-3"
            onClick={onCreateClick}
            aria-label="Create new pipeline"
          >
            <PlusIcon size={14} />
            Create
          </Button>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <PlatformBadge />
          <AiToggleButton compact />
          {isAuthEnabled && <UserSection />}
          <NotificationBadge />
          <HelpMenu />

          {/* Mobile burger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="absolute top-full left-0 right-0 bg-[var(--elevated-background)] border-b border-[var(--surface-border)] shadow-lg z-40 lg:hidden"
        >
          <nav className="flex flex-col gap-1 p-3" aria-label="Mobile navigation">
            {primaryNavItems.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2.5 px-3 py-2 rounded-md body-3 transition-colors',
                    active
                      ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                      : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)] hover:bg-[var(--interactive-hover-bg)]',
                  ].join(' ')}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
            <div className="pt-1 border-t border-[var(--surface-border)] mt-1">
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 w-full"
                onClick={() => { setIsMobileMenuOpen(false); onCreateClick?.() }}
                aria-label="Create new pipeline"
              >
                <PlusIcon size={14} />
                Create
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
