'use client'

import { Button } from '@/src/components/ui/button'

export default function LogoutButton() {
  return (
    <Button asChild variant="ghost" size="sm">
      <a href="/api/auth/logout">Log Out</a>
    </Button>
  )
}
