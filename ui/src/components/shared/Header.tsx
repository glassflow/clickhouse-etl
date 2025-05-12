'use client'

import Image from 'next/image'
import { Avatar } from '@/src/components/ui/avatar'
import logo from '@/src/images/logo.svg'

const menuItems = [
  { label: 'Create', link: '/create' },
  { label: 'Pipelines', link: '/pipelines' },
  { label: 'Spaces', link: '/spaces' },
  { label: 'Examples', link: '/examples' },
]

export function Header() {
  return (
    <header className="h-16 w-full min-w-[var(--main-container-width)] max-w-[var(--main-container-width)] mx-auto">
      <div className="container h-full">
        <div className="flex items-center justify-between h-full w-full">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Image src={logo} alt="Glassflow Logo" width={34} height={22} />
          </div>

          {/* Menu Items */}
          <nav className="flex items-center gap-16 flex-grow justify-center">
            {menuItems.map((item) => (
              <a key={item.label} href={item.link} className="text-sm font-medium transition-colors hover:text-primary">
                {item.label}
              </a>
            ))}
          </nav>

          {/* User Avatar */}
          <Avatar className="h-8 w-8">
            <span className="text-xs font-medium">JD</span>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
