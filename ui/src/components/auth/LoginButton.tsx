'use client'

import { Button } from '@/src/components/ui/button'

export default function LoginButton() {
  return (
    <Button asChild variant="default" size="sm">
      <a href="/api/auth/login">Log In</a>
    </Button>
  )
}
