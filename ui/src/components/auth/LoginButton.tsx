'use client'

import { Button } from '@/src/components/ui/button'

export default function LoginButton() {
  return (
    <Button asChild type="button" variant="primary" size="custom" className="flex items-center gap-2">
      <a href="/api/auth/login">Log In / Sign Up</a>
    </Button>
  )
}
