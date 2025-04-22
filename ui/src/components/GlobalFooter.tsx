'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { usePathname } from 'next/navigation'

export default function GlobalFooter() {
  const [showButtons, setShowButtons] = useState(false)
  const pathname = usePathname()

  // Hide footer on home page
  if (pathname === '/' || pathname === '/home') {
    return null
  }

  return (
    <div className="relative">
      {!showButtons ? (
        <span className="cursor-pointer hover:text-primary-600 animate-fadeIn" onClick={() => setShowButtons(true)}>
          Any questions?
        </span>
      ) : (
        <div className="flex items-center gap-[24px] animate-slideDown">
          <Button
            className="btn-tertiary"
            type="button"
            variant="outline"
            size="custom"
            onClick={() => setShowButtons(false)}
          >
            Ask a question
          </Button>
          <Button
            className="btn-tertiary"
            type="button"
            variant="outline"
            size="custom"
            onClick={() => setShowButtons(false)}
          >
            View documentation
          </Button>
        </div>
      )}
    </div>
  )
}
