'use client'

import { Button } from '@/src/components/ui/button'

export default function LoginButton() {
  return (
    <Button asChild type="button" variant="primary" size="custom">
      <a href="/api/auth/login">Log In / Sign Up</a>
    </Button>
  )
}
