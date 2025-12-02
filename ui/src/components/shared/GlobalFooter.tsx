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
      <div className="flex items-center">
        <span className="cursor-pointer hover:text-primary-600" onMouseEnter={() => setShowButtons(true)}>
          Any questions?
        </span>

        {showButtons && (
          <div
            className="flex items-center gap-3 ml-4 animate-slideInFromRight"
            onMouseLeave={() => {
              setShowButtons(false)
            }}
          >
            <Link
              href="https://github.com/glassflow/clickhouse-etl/issues"
              target="_blank"
              rel="noopener noreferrer"
              passHref
            >
              <Button className="btn-tertiary" type="button" variant="outline" size="custom">
                Report an issue
              </Button>
            </Link>
            <Link href="https://www.glassflow.dev/contact" target="_blank" rel="noopener" passHref>
              <Button className="btn-tertiary" type="button" variant="outline" size="custom">
                Get help
              </Button>
            </Link>
            <Link href="https://docs.glassflow.dev/" target="_blank" rel="noopener" passHref>
              <Button className="btn-tertiary" type="button" variant="outline" size="custom">
                View documentation
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
