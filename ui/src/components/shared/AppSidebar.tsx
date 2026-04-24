'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import logoFullName from '../../images/logo-full-name.svg'
import { Button } from '@/src/components/ui/button'
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
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  matchPaths?: string[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboardIcon size={18} />,
    matchPaths: ['/dashboard'],
  },
  {
    href: '/pipelines',
    label: 'Pipelines',
    icon: <WorkflowIcon size={18} />,
    matchPaths: ['/pipelines'],
  },
  {
    href: '/library',
    label: 'Library',
    icon: <LibraryBigIcon size={18} />,
    matchPaths: ['/library'],
  },
  {
    href: '/observability',
    label: 'Observability',
    icon: <ActivityIcon size={18} />,
    matchPaths: ['/observability'],
  },
]

function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md body-3 text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)] hover:bg-[var(--interactive-hover-bg)] transition-colors"
        aria-expanded={isOpen}
        aria-label="Help menu"
      >
        <ChevronDownIcon
          size={14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
        Help
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-[var(--color-background-elevation-raised-faded-2)] surface-gradient-border rounded-md shadow-lg py-1 z-50">
          <a
            href="https://docs.glassflow.dev/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <BookOpenIcon size={14} />
            View Docs
          </a>
          <a
            href="https://www.glassflow.dev/contact"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <MessageCircleIcon size={14} />
            Contact Us
          </a>
          <a
            href="https://github.com/glassflow/clickhouse-etl/issues"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-neutral)] hover:bg-[var(--color-background-elevation-raised-faded)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <BugIcon size={14} />
            Report an Issue
          </a>
        </div>
      )}
    </div>
  )
}

type AppSidebarProps = {
  onCreateClick?: () => void
  aiEnabled?: boolean
}

export function AppSidebar({ onCreateClick, aiEnabled = false }: AppSidebarProps) {
  const pathname = usePathname()
  const runtimeEnv = getRuntimeEnv()
  const isAuthEnabled = runtimeEnv?.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

  const isActive = (item: NavItem): boolean => {
    const paths = item.matchPaths ?? [item.href]
    return paths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <aside
      className="flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-[var(--surface-border)] bg-[var(--elevated-background)]"
      aria-label="Application navigation"
    >
      {/* Logo */}
      <div className="flex items-center px-5 h-16 border-b border-[var(--surface-border)] shrink-0">
        <Link href="/dashboard" aria-label="Go to dashboard">
          <Image
            src={logoFullName}
            alt="Glassflow"
            width={130}
            height={28}
            className="w-auto h-[18px]"
            priority
          />
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1 px-3 pt-4 flex-1 overflow-y-auto" aria-label="Main navigation">
        {/* Create button */}
        <div className="px-1 pb-3">
          <Button
            variant="primary"
            size="sm"
            className="w-full gap-2"
            onClick={onCreateClick}
            aria-label="Create new pipeline"
          >
            <PlusIcon size={16} />
            Create
          </Button>
        </div>

        {/* Nav items */}
        {navItems.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md body-3 transition-colors',
                active
                  ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                  : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)] hover:bg-[var(--interactive-hover-bg)]',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={active ? 'text-[var(--color-foreground-primary)]' : 'text-[var(--color-foreground-neutral-faded)]'}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: platform, user, help, notifications */}
      <div className="flex flex-col gap-2 px-3 pb-4 pt-2 border-t border-[var(--surface-border)] shrink-0">
        <div className="flex items-center justify-between px-1 py-1">
          <PlatformBadge />
          <div className="flex items-center gap-1">
            {isAuthEnabled && <UserSection />}
            <NotificationBadge />
          </div>
        </div>
        <HelpMenu />
      </div>
    </aside>
  )
}
