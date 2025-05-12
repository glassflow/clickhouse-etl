'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

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
          <Link href="https://www.glassflow.dev/contact-us#form" target="_blank" rel="noopener noreferrer" passHref>
            <Button
              className="btn-tertiary"
              type="button"
              variant="outline"
              size="custom"
              onClick={() => setShowButtons(false)}
            >
              Ask Us
            </Button>
          </Link>
          <Link href="https://github.com/glassflow/clickhouse-etl" target="_blank" rel="noopener noreferrer" passHref>
            <Button className="btn-tertiary" type="button" variant="outline" size="custom">
              View documentation
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
