'use client'

import { ReactNode } from 'react'

interface HeaderWrapperProps {
  children: ReactNode
}

export function HeaderWrapper({ children }: HeaderWrapperProps) {
  return (
    <header
      className="w-full shrink-0 sticky top-0 z-50 bg-[var(--color-background-elevation-base)]"
      style={{
        boxShadow:
          'var(--Shadow-Styles-Overlay-Layer-1-X, 0px) 1px 1px var(--Shadow-Styles-Overlay-Layer-1-Spread, 0px) #3A3A3A',
      }}
    >
      {children}
    </header>
  )
}
