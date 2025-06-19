'use client'

import { useState } from 'react'
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
import { InfoModal, ModalResult } from '@/src/components/common/Modal'
import { Button } from '@/src/components/ui/button'
import classnames from 'classnames'

const NavButton = ({ href, icon, label }: { href: string; icon: any; label: string }) => {
  return (
    <li className="text-sm font-medium relative group h-full pt-3">
      <Link
        href={href}
        className="flex items-center gap-2 transition-colors whitespace-nowrap min-w-[60px] pb-2 pr-4 w-full h-full"
      >
        <Image src={icon} alt={label} width={24} height={24} />
        {label}
      </Link>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-300/30 via-orange-400 to-orange-300/30 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"></div>
    </li>
  )
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { resetPipelineState } = useStore()

  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false)

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message: 'Returning to the first step will reset the pipeline! Are you sure you want to perform this action?',
    title: 'Reset pipeline state',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

  const handleLogoClick = () => {
    if (pathname !== '/home') {
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
    <div className="h-16 w-full min-w-[var(--main-container-width)] max-w-[var(--main-container-width)] mx-auto">
      <div className="container h-full">
        <div className="flex flex-row justify-between items-center h-full">
          <div className="flex flex-row justify-start items-center gap-4 h-full">
            <div className="flex flex-start justify-start h-full w-full items-center">
              <Button variant="ghost" onClick={handleLogoClick} className="p-0 hover:bg-transparent">
                <Image src={logoFullName} alt="Glassflow Logo" width={140} height={30} className="cursor-pointer" />
              </Button>
            </div>
            <nav className="flex flex-row items-center gap-4 h-full">
              <ul className="flex flex-row items-center gap-8 h-full">
                <NavButton href="/home" icon={ListIcon} label="Create" />
                <NavButton href="/pipelines" icon={PlugIcon} label="Pipelines" />
                <NavButton href="/connections" icon={Plug2Icon} label="Source/Sink Connections" />
              </ul>
            </nav>
          </div>
          <div className="flex flex-row justify-end items-center gap-4 h-full">
            <div className="relative">
              <div
                className="flex flex-row items-center gap-2 cursor-pointer"
                onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
              >
                <Button variant="ghost" className="flex items-center gap-2">
                  Help
                </Button>
                <div className="flex flex-row items-center gap-2">
                  {isHelpMenuOpen ? (
                    <Image src={ChevronUpIcon} alt="Chevron Up" width={16} height={16} />
                  ) : (
                    <Image src={ChevronDownIcon} alt="Chevron Down" width={16} height={16} />
                  )}
                </div>
              </div>

              <div
                id="help-menu"
                className={classnames(
                  'absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1',
                  isHelpMenuOpen ? 'block' : 'hidden',
                )}
              >
                <a
                  href="https://docs.glassflow.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  View Docs
                </a>
                <a
                  href="https://github.com/glassflow/glassflow/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Contact Us
                </a>
                <a
                  href="mailto:support@glassflow.dev"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Report an Issue
                </a>
              </div>
            </div>
          </div>
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
