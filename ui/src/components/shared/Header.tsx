'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import logoFullName from '../../images/logo-full-name.svg'
import ListIcon from '../../images/list.svg'
import PlugIcon from '../../images/plus.svg'
import Plug2Icon from '../../images/plug2.svg'
import ChevronDownIcon from '../../images/chevron-down.svg'
import ChevronUpIcon from '../../images/chevron-up.svg'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useStore } from '@/src/store'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import HelpIcon from '../../images/help-questionmark.svg'
import { Button } from '@/src/components/ui/button'
import CloseIcon from '../../images/close.svg'
import BurgerIcon from '../../images/menu-burger-horizontal.svg'

const NavButton = ({ href, icon, label }: { href: string; icon: any; label: string }) => {
  return (
    <li className="text-sm font-medium relative group h-full flex items-center pt-3">
      <Link
        href={href}
        className="flex items-center gap-2 transition-colors whitespace-nowrap min-w-[60px] px-4 pb-2 h-full"
      >
        <Image src={icon} alt={label} width={24} height={24} />
        {label}
      </Link>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-300/30 via-orange-400 to-orange-300/30 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"></div>
    </li>
  )
}

const MobileNavButton = ({
  href,
  icon,
  label,
  onClick,
}: {
  href: string
  icon: any
  label: string
  onClick?: () => void
}) => {
  return (
    <li className="text-sm font-medium">
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-800 rounded-md"
        onClick={onClick}
      >
        <Image src={icon} alt={label} width={20} height={20} />
        {label}
      </Link>
    </li>
  )
}

const HelpMenu = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, setIsOpen])

  const handleMenuItemClick = () => {
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" className="p-2 lg:px-3 lg:py-2" onClick={() => setIsOpen(!isOpen)}>
        {/* Mobile: Show icon only */}
        <div className="lg:hidden">
          <Image src={HelpIcon} alt="Help" width={24} height={24} />
        </div>

        {/* Desktop: Show text with chevron */}
        <div className="hidden lg:flex items-center gap-2">
          Help
          <Image src={isOpen ? ChevronUpIcon : ChevronDownIcon} alt="Toggle" width={16} height={16} />
        </div>
      </Button>

      <div
        className={`absolute right-0 mt-2 w-48 bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md shadow-lg py-1 background z-50 ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        <a
          href="https://docs.glassflow.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={handleMenuItemClick}
        >
          View Docs
        </a>
        <a
          href="mailto:help@glassflow.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={handleMenuItemClick}
        >
          Contact Us
        </a>
        <a
          href="https://github.com/glassflow/clickhouse-etl/issues"
          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={handleMenuItemClick}
        >
          Report an Issue
        </a>
      </div>
    </div>
  )
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { coreStore } = useStore()
  const { resetPipelineState } = coreStore

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false)

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message:
      'Returning to the home page will discard current pipeline configuration. Are you sure you want to perform this action?',
    title: 'Discard pipeline configuration',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Click outside and Escape for mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isMobileMenuOpen])

  const handleLogoClick = () => {
    if (pathname === '/pipelines/create') {
      setModalProps((prev) => ({ ...prev, visible: true }))
    }
  }

  const handleModalComplete = (result: string) => {
    setModalProps((prev) => ({ ...prev, visible: false }))

    if (result === ModalResult.YES) {
      // Clear the pipeline state
      resetPipelineState('', true)
      router.push('/home')
    }
  }

  return (
    <div className="h-16 w-full max-w-[var(--main-container-width)] mx-auto">
      <div className="container h-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row justify-between items-center h-full">
          {/* Left Section: Mobile Menu + Desktop Logo + Navigation */}
          <div className="flex items-center h-full">
            <div className="lg:hidden flex items-center">
              <Button variant="ghost" className="p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Image src={isMobileMenuOpen ? CloseIcon : BurgerIcon} alt="Menu" width={24} height={24} />
              </Button>
            </div>

            {/* Desktop: Logo (Left) */}
            <div className="hidden lg:flex items-center pr-12 border-r border-r-[#3A3A3A]">
              <Button variant="ghost" onClick={handleLogoClick} className="p-0 hover:bg-transparent">
                <Image
                  src={logoFullName}
                  alt="Glassflow Logo"
                  width={140}
                  height={30}
                  className="cursor-pointer w-auto h-8"
                />
              </Button>
            </div>

            {/* Mobile: Logo (Center) */}
            <div className="lg:hidden flex items-center justify-center flex-1">
              <Button variant="ghost" onClick={handleLogoClick} className="p-0 hover:bg-transparent">
                <Image
                  src={logoFullName}
                  alt="Glassflow Logo"
                  width={140}
                  height={30}
                  className="cursor-pointer w-auto h-6 sm:h-8"
                />
              </Button>
            </div>

            {/* Desktop Navigation (after logo) */}
            <nav className="hidden lg:flex flex-row h-full ml-12">
              <ul className="flex flex-row h-full">
                <NavButton href="/home" icon={PlugIcon} label="Create" />
                <NavButton href="/pipelines" icon={ListIcon} label="Pipelines" />
                {/* <NavButton href="/connections" icon={Plug2Icon} label="Source/Sink Connections" /> */}
              </ul>
            </nav>
          </div>

          {/* Right Section: Help Menu */}
          <div className="flex items-center">
            <HelpMenu isOpen={isHelpMenuOpen} setIsOpen={setIsHelpMenuOpen} />
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div
          ref={mobileMenuRef}
          className={`lg:hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          }`}
        >
          <nav className="py-4 bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md z-10">
            <ul className="flex flex-col gap-4">
              <MobileNavButton href="/home" icon={PlugIcon} label="Create" onClick={() => setIsMobileMenuOpen(false)} />
              <MobileNavButton
                href="/pipelines"
                icon={ListIcon}
                label="Pipelines"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              {/* <MobileNavButton
                href="/connections"
                icon={Plug2Icon}
                label="Source/Sink Connections"
                onClick={() => setIsMobileMenuOpen(false)}
              /> */}
            </ul>
          </nav>
        </div>
      </div>
      <InfoModal
        visible={modalProps.visible}
        title={modalProps.title}
        description={modalProps.message}
        okButtonText={modalProps.okButtonText}
        cancelButtonText={modalProps.cancelButtonText}
        onComplete={handleModalComplete}
      />
    </div>
  )
}
