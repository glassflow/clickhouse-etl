'use client'

import { Button } from '@/src/components/ui/button'

export default function LoginButton() {
  return (
    <Button asChild className="btn-primary" type="button" variant="gradient" size="custom">
      <a href="/api/auth/login">Log In / Sign Up</a>
    </Button>
  )
}
